/**
 * Bluetooth receipt printing: Web Bluetooth (Android/Chrome) + Capacitor/iOS native BLE.
 * Builds ESC/POS from the same receipt data used for PDF; supports "remember printer".
 */

import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

const STORAGE_KEY = 'shoopkeeper_bluetooth_printer_id';

// ESC/POS commands (decimal)
const ESC = 0x1b;
const GS = 0x1d;
const ESC_INIT = [ESC, 0x40];
const ESC_ALIGN_LEFT = [ESC, 0x61, 0x00];
const ESC_ALIGN_CENTER = [ESC, 0x61, 0x01];
const ESC_BOLD_ON = [ESC, 0x45, 0x01];
const ESC_BOLD_OFF = [ESC, 0x45, 0x00];
const GS_CUT_FULL = [GS, 0x56, 0x00];

// Common BLE service/characteristic UUIDs for serial/print
const BLE_SERIAL_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_SERIAL_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';
const BLE_NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NUS_CHAR_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Web Bluetooth API types (not in default DOM lib)
interface WebBluetoothRemoteGATTCharacteristic {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}
interface WebBluetoothRemoteGATTServer {
  connect(): Promise<WebBluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristics(): Promise<WebBluetoothRemoteGATTCharacteristic[]> }>;
  getPrimaryServices(): Promise<Array<{ getCharacteristics(): Promise<WebBluetoothRemoteGATTCharacteristic[]> }>>;
}
interface WebBluetoothDevice {
  id: string;
  gatt?: WebBluetoothRemoteGATTServer;
}
interface WebBluetooth {
  requestDevice(options: { acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<WebBluetoothDevice>;
  getDevices(): Promise<WebBluetoothDevice[]>;
}

const CHUNK_SIZE = 512;

/** True when running inside Capacitor native app (iOS or Android). */
function isCapacitorNative(): boolean {
  try {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  } catch {
    return false;
  }
}

export type ReceiptPrintPayload = {
  sale: {
    id?: string;
    sale_number?: string;
    created_at?: string;
    payment_method?: string;
    total_amount?: number;
    tax_amount?: number;
    final_amount?: number;
    discount_amount?: number;
    payment_reference?: string;
    auth_code?: string;
    customer?: { name?: string; phone?: string };
    items?: Array<{
      id?: string;
      quantity?: number;
      unit_price?: number;
      total_price?: number;
      product?: { name?: string };
    }>;
  };
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  cashierName?: string;
  currency: string;
};

function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${value.toFixed(2)}`;
}

/** Build ESC/POS byte array from receipt payload (same data shape as PDF receipt). */
export function buildEscPosReceipt(args: ReceiptPrintPayload): Uint8Array {
  const { sale, shopName, shopAddress, shopPhone, shopEmail, cashierName, currency } = args;
  const saleDate = sale?.created_at ? new Date(sale.created_at) : new Date();
  const paymentLabel = String(sale?.payment_method || 'cash').replace(/_/g, ' ');
  const items = Array.isArray(sale?.items) ? sale.items : [];

  const lines: string[] = [];
  const push = (text: string, center = false, bold = false) => {
    lines.push(JSON.stringify({ text: text || ' ', center, bold }));
  };

  push('');
  push((shopName || 'ShopKeeper').toUpperCase(), true, true);
  if (shopAddress) push(`Address: ${shopAddress}`, true);
  if (shopPhone) push(`Phone: ${shopPhone}`, true);
  if (shopEmail) push(`Email: ${shopEmail}`, true);
  push('', true);
  push('--------------------------------', true);
  push(`Sale: ${sale?.sale_number || '-'}`);
  push(`Date: ${saleDate.toLocaleString()}`);
  if (cashierName) push(`Cashier: ${cashierName}`);
  push('--------------------------------');
  push('Items:');

  if (!items.length) {
    push('- No line items');
  } else {
    items.slice(0, 50).forEach((item) => {
      const qty = Number(item?.quantity || 0);
      const total = Number(item?.total_price || 0);
      const name = (item?.product?.name || 'Product').slice(0, 24);
      push(`- ${name} x${qty} = ${formatMoney(total, currency)}`);
    });
  }

  push('');
  push(`Payment: ${paymentLabel}`);
  if (Number(sale?.discount_amount || 0) > 0) {
    push(`Discount: ${formatMoney(Number(sale?.discount_amount || 0), currency)}`);
  }
  push(`Total: ${formatMoney(Number(sale?.final_amount || 0), currency)}`);
  push('');
  push('Thank you for shopping with us.', true);
  push('');
  push('');

  const encoder = new TextEncoder();
  const chunks: number[] = [];
  chunks.push(...ESC_INIT);

  for (const line of lines) {
    try {
      const { text, center, bold } = JSON.parse(line) as { text: string; center: boolean; bold: boolean };
      if (center) chunks.push(...ESC_ALIGN_CENTER);
      else chunks.push(...ESC_ALIGN_LEFT);
      if (bold) chunks.push(...ESC_BOLD_ON);
      const safe = text.replace(/[^\x20-\x7e\r\n\t]/g, '?');
      const bytes = encoder.encode(safe + '\n');
      for (let i = 0; i < bytes.length; i++) chunks.push(bytes[i]);
      if (bold) chunks.push(...ESC_BOLD_OFF);
    } catch {
      chunks.push(...ESC_ALIGN_LEFT);
      const bytes = encoder.encode(line + '\n');
      for (let i = 0; i < bytes.length; i++) chunks.push(bytes[i]);
    }
  }

  chunks.push(...ESC_ALIGN_LEFT);
  chunks.push(...GS_CUT_FULL);

  return new Uint8Array(chunks);
}

export function isBluetoothPrintSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  if ((navigator as any).bluetooth) return true;
  return isCapacitorNative();
}

export function getSavedPrinterId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSavedPrinterId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function clearSavedPrinter(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type PrintResult = { ok: true } | { ok: false; error: string };

async function findWritableCharacteristic(device: WebBluetoothDevice): Promise<WebBluetoothRemoteGATTCharacteristic | null> {
  const server = await device.gatt!.connect();
  const services = [
    BLE_SERIAL_SERVICE,
    BLE_NUS_SERVICE,
    '0000ff00-0000-1000-8000-00805f9b34fb',
  ];
  for (const uuid of services) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) return c;
      }
    } catch {
      continue;
    }
  }
  const primaryServices = await server.getPrimaryServices();
  for (const service of primaryServices) {
    const chars = await service.getCharacteristics();
    for (const c of chars) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
    }
  }
  return null;
}

async function sendToCharacteristic(
  characteristic: WebBluetoothRemoteGATTCharacteristic,
  data: Uint8Array
): Promise<void> {
  const useWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    if (useWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}

async function getOrRequestDeviceIdNative(remember: boolean): Promise<string | null> {
  await BleClient.initialize();
  const savedId = getSavedPrinterId();
  if (savedId) {
    try {
      const devices = await BleClient.getDevices([savedId]);
      if (devices.length > 0) return devices[0].deviceId;
    } catch {
      // device may be out of range or forgotten
    }
  }
  const device = await BleClient.requestDevice({
    optionalServices: [BLE_SERIAL_SERVICE, BLE_NUS_SERVICE, '0000ff00-0000-1000-8000-00805f9b34fb'],
  });
  if (remember && device?.deviceId) setSavedPrinterId(device.deviceId);
  return device?.deviceId ?? null;
}

async function connectAndPrintNative(
  data: Uint8Array,
  options: { deviceId?: string | null; remember?: boolean } = {}
): Promise<PrintResult> {
  try {
    await BleClient.initialize();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Bluetooth unavailable.' };
  }
  let deviceId: string | null = options.remember !== false ? (options.deviceId ?? getSavedPrinterId()) : options.deviceId ?? null;
  if (!deviceId) {
    try {
      deviceId = await getOrRequestDeviceIdNative(options.remember ?? true);
    } catch (err: any) {
      return { ok: false, error: err?.name === 'cancel' ? 'No printer selected.' : err?.message || 'Could not connect to printer.' };
    }
  }
  if (!deviceId) return { ok: false, error: 'No printer selected.' };
  try {
    await BleClient.connect(deviceId);
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Connection failed.' };
  }
  const pairs: [string, string][] = [
    [BLE_SERIAL_SERVICE, BLE_SERIAL_CHAR],
    [BLE_NUS_SERVICE, BLE_NUS_CHAR_WRITE],
  ];
  let written = false;
  for (const [service, characteristic] of pairs) {
    try {
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        const copy = new Uint8Array(chunk);
        const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
        await BleClient.writeWithoutResponse(deviceId, service, characteristic, view);
      }
      written = true;
      break;
    } catch {
      continue;
    }
  }
  try {
    await BleClient.disconnect(deviceId);
  } catch {
    // ignore
  }
  if (!written) return { ok: false, error: 'Printer does not support writing. Try another device.' };
  return { ok: true };
}

export async function requestPrinter(remember: boolean): Promise<WebBluetoothDevice | null> {
  if (!isBluetoothPrintSupported()) return null;
  if (isCapacitorNative()) {
    try {
      await getOrRequestDeviceIdNative(remember);
      return {} as WebBluetoothDevice;
    } catch {
      return null;
    }
  }
  const nav = (navigator as any).bluetooth as WebBluetooth;
  const device = await nav.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      BLE_SERIAL_SERVICE,
      BLE_NUS_SERVICE,
      '0000ff00-0000-1000-8000-00805f9b34fb',
      'battery_service',
    ],
  });
  if (remember && device?.id) setSavedPrinterId(device.id);
  return device;
}

export async function connectAndPrint(
  data: Uint8Array,
  options: { deviceId?: string | null; remember?: boolean } = {}
): Promise<PrintResult> {
  if (!isBluetoothPrintSupported()) {
    return { ok: false, error: 'Bluetooth printing is not supported in this browser. Use Send PDF receipt instead.' };
  }
  if (isCapacitorNative()) return connectAndPrintNative(data, options);

  const nav = (navigator as any).bluetooth as WebBluetooth;
  let device: WebBluetoothDevice | null = null;

  if (options.deviceId) {
    try {
      const devices = await nav.getDevices();
      device = devices.find((d: WebBluetoothDevice) => d.id === options.deviceId!) ?? null;
    } catch {
      // getDevices may not be available in all browsers
    }
  }

  if (!device) {
    try {
      device = await requestPrinter(options.remember ?? false);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') return { ok: false, error: 'No printer selected.' };
      return { ok: false, error: err?.message || 'Could not connect to printer.' };
    }
  }

  if (!device?.gatt) return { ok: false, error: 'Invalid device.' };

  try {
    const characteristic = await findWritableCharacteristic(device);
    if (!characteristic) return { ok: false, error: 'Printer does not support writing. Try another device.' };
    await sendToCharacteristic(characteristic, data);
    device.gatt?.disconnect();
    return { ok: true };
  } catch (err: any) {
    device.gatt?.disconnect?.();
    return { ok: false, error: err?.message || 'Print failed.' };
  }
}

export async function printReceipt(
  payload: ReceiptPrintPayload,
  options: { rememberPrinter?: boolean } = {}
): Promise<PrintResult> {
  const data = buildEscPosReceipt(payload);
  const deviceId = options.rememberPrinter !== false ? getSavedPrinterId() : null;
  return connectAndPrint(data, { deviceId, remember: options.rememberPrinter ?? true });
}
