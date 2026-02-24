import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import shopkeeperLogoUrl from '../../../assets/shopkeeper-logo.png';

const RECEIPT_COLORS = {
  primary: [37, 99, 235] as const, // #2563eb
  primaryDark: [30, 64, 175] as const, // #1e40af
  secondary: [16, 185, 129] as const, // #10b981
  accent: [245, 158, 11] as const, // #f59e0b
  danger: [220, 38, 38] as const, // #dc2626
  text: [17, 24, 39] as const,
  divider: [229, 231, 235] as const,
  paper: [249, 250, 251] as const,
};

function drawHorizontalGradient(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  steps: number = 40
) {
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const r = Math.round(start[0] + (end[0] - start[0]) * t);
    const g = Math.round(start[1] + (end[1] - start[1]) * t);
    const b = Math.round(start[2] + (end[2] - start[2]) * t);
    const stripeX = x + (width * i) / steps;
    const stripeW = width / steps + 0.6;
    doc.setFillColor(r, g, b);
    doc.rect(stripeX, y, stripeW, height, 'F');
  }
}

function drawDiagonalGradient(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  steps: number = 56
) {
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const r = Math.round(start[0] + (end[0] - start[0]) * t);
    const g = Math.round(start[1] + (end[1] - start[1]) * t);
    const b = Math.round(start[2] + (end[2] - start[2]) * t);

    // Blend x + y progress to simulate diagonal transition.
    const stripeY = y + (height * i) / steps;
    const stripeXOffset = (width * i) / (steps * 3);
    const stripeH = height / steps + 1;
    doc.setFillColor(r, g, b);
    doc.rect(x + stripeXOffset, stripeY, width - stripeXOffset, stripeH, 'F');
  }
}

type SaleItemLike = {
  id?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  product?: { name?: string };
};

type SaleLike = {
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
  items?: SaleItemLike[];
};

function formatMoney(amount: number, currency: string) {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${value.toFixed(2)}`;
}

let cachedLogoDataUrl: string | null = null;

async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const response = await fetch(shopkeeperLogoUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl || null;
    return cachedLogoDataUrl;
  } catch {
    return null;
  }
}

async function buildQrDataUrl(value: string) {
  try {
    return await QRCode.toDataURL(value, {
      margin: 1,
      width: 128,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

function toShortReceiptNumber(saleNumber: string) {
  const digits = (saleNumber.match(/\d+/g) || []).join('');
  if (digits.length >= 8) return `SK-${digits.slice(-8)}`;
  const clean = saleNumber.replace(/[^a-zA-Z0-9]/g, '');
  return `SK-${clean.slice(-8) || Date.now().toString().slice(-8)}`;
}

export function normalizePhoneForWhatsApp(rawPhone: string, defaultCountryCode: string = '233') {
  const input = String(rawPhone || '').trim();
  if (!input) return null;

  let sanitized = input.replace(/[^\d+]/g, '');
  if (sanitized.startsWith('00')) {
    sanitized = `+${sanitized.slice(2)}`;
  }

  if (sanitized.startsWith('+')) {
    sanitized = sanitized.slice(1);
  } else if (sanitized.startsWith('0')) {
    sanitized = `${defaultCountryCode}${sanitized.slice(1)}`;
  }

  sanitized = sanitized.replace(/\D/g, '');
  if (sanitized.length < 8) return null;
  return sanitized;
}

export function buildWhatsAppReceiptMessage(args: {
  sale: SaleLike;
  shopName: string;
  currency: string;
}) {
  const { sale, shopName, currency } = args;
  const saleDate = sale?.created_at ? new Date(sale.created_at) : new Date();
  const paymentLabel = String(sale?.payment_method || 'cash').replace(/_/g, ' ');
  const items = Array.isArray(sale?.items) ? sale.items : [];

  const lines: string[] = [
    `Receipt - ${shopName || 'ShopKeeper'}`,
    `Sale No: ${sale?.sale_number || '-'}`,
    `Date: ${saleDate.toLocaleString()}`,
    '',
    'Items:',
  ];

  if (!items.length) {
    lines.push('- No line items');
  } else {
    items.slice(0, 25).forEach((item) => {
      const qty = Number(item?.quantity || 0);
      const total = Number(item?.total_price || 0);
      const name = item?.product?.name || 'Product';
      lines.push(`- ${name} x${qty} = ${formatMoney(total, currency)}`);
    });
  }

  lines.push('');
  lines.push(`Payment: ${paymentLabel}`);
  if (Number(sale?.discount_amount || 0) > 0) {
    lines.push(`Discount: ${formatMoney(Number(sale?.discount_amount || 0), currency)}`);
  }
  lines.push(`Total: ${formatMoney(Number(sale?.final_amount || 0), currency)}`);
  lines.push('');
  lines.push('Thank you for shopping with us.');

  return lines.join('\n');
}

export function buildWhatsAppLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function createReceiptPdfFile(args: {
  sale: SaleLike;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  cashierName?: string;
  currency: string;
  verifyBaseUrl?: string;
}) {
  const {
    sale,
    shopName,
    shopAddress,
    shopPhone,
    shopEmail,
    cashierName,
    currency,
    verifyBaseUrl,
  } = args;
  const saleDate = sale?.created_at ? new Date(sale.created_at) : new Date();
  const paymentLabel = String(sale?.payment_method || 'cash').replace(/_/g, ' ');
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const saleNumberRaw = String(sale?.sale_number || `SALE-${Date.now()}`);
  const saleNumberShort = toShortReceiptNumber(saleNumberRaw);
  const receiptRef = String((sale as any)?.id || saleNumberShort).trim();
  const saleIsoDate = saleDate.toLocaleString();
  const verifyUrl = `${
    verifyBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://shopkeeper.app')
  }/verify/${encodeURIComponent(receiptRef)}`;
  const subtotal = Number(sale?.total_amount ?? items.reduce((sum, item) => sum + Number(item?.total_price || 0), 0));
  const discount = Number(sale?.discount_amount || 0);
  const tax = Number(sale?.tax_amount || 0);
  const total = Number(sale?.final_amount ?? subtotal - discount + tax);
  const amountPaid = total;
  const change = 0;
  const paymentReference = String(
    sale?.payment_reference ||
      (sale as any)?.reference ||
      (sale as any)?.paystack_reference ||
      (sale as any)?.metadata?.reference ||
      ''
  ).trim();
  const authCode = String(sale?.auth_code || (sale as any)?.authorization_code || '').trim();
  const qrDataUrl = await buildQrDataUrl(verifyUrl);
  const safeShopName = (shopName || 'ShopKeeper').toUpperCase();
  const safeShopAddress = String(shopAddress || 'Address not set');
  const safeShopPhone = String(shopPhone || 'Phone not set');
  const safeShopEmail = String(shopEmail || 'Email not set');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  let y = margin;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  // Compact and printable header
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 94, 8, 8, 'F');
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 94, 8, 8, 'S');
  drawDiagonalGradient(
    doc,
    margin + 1,
    y + 1,
    pageWidth - margin * 2 - 2,
    92,
    [199, 224, 255], // stronger blue tint
    [191, 248, 223], // stronger green tint
    60
  );
  // Extra brand ribbon to make gradient visibly intentional.
  drawDiagonalGradient(
    doc,
    margin + 1,
    y + 1,
    pageWidth - margin * 2 - 2,
    12,
    RECEIPT_COLORS.primary,
    RECEIPT_COLORS.accent,
    80
  );
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 94, 8, 8, 'S');
  const logoDataUrl = await getLogoDataUrl();
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 10, y + 10, 32, 32, 6, 6, 'F');
    doc.addImage(logoDataUrl, 'PNG', margin + 12, y + 12, 28, 28);
  } else {
    doc.setFillColor(...RECEIPT_COLORS.primary);
    doc.roundedRect(margin + 12, y + 12, 28, 28, 4, 4, 'F');
  }
  doc.setTextColor(...RECEIPT_COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16); // Business Name typography
  doc.text(safeShopName, margin + 50, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.6);
  doc.text(`Address: ${safeShopAddress}`, margin + 50, y + 39);
  doc.text(`Tel: ${safeShopPhone}`, margin + 50, y + 52);
  doc.text(`Email: ${safeShopEmail}`, margin + 50, y + 65);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Receipt #: ${saleNumberShort}`, margin, y + 112);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${saleIsoDate}`, pageWidth - margin, y + 112, { align: 'right' });
  doc.text(`Cashier: ${cashierName || 'N/A'}`, margin, y + 127);
  doc.text(`Payment: ${paymentLabel}`, pageWidth - margin, y + 127, { align: 'right' });
  doc.setTextColor(...RECEIPT_COLORS.text);
  y += 139;
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Table headers
  const tableWidth = pageWidth - margin * 2;
  const qtyX = margin + tableWidth - 220;
  const priceX = margin + tableWidth - 140;
  const totalX = margin + tableWidth - 12;
  // Dedicated gradient in items header section.
  drawHorizontalGradient(
    doc,
    margin,
    y,
    tableWidth,
    24,
    [225, 236, 255],
    [255, 241, 214],
    50
  );
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.roundedRect(margin, y, tableWidth, 24, 4, 4, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13); // Section headers typography
  doc.setTextColor(...RECEIPT_COLORS.text);
  doc.text('Item', margin + 10, y + 16);
  doc.text('Qty', qtyX, y + 16);
  doc.text('Price', priceX, y + 16);
  doc.text('Total', totalX, y + 16, { align: 'right' });
  y += 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...RECEIPT_COLORS.text);
  let rowIndex = 0;
  items.forEach((item) => {
    ensureSpace(26);
    const name = String(item?.product?.name || 'Product');
    const qty = Number(item?.quantity || 0);
    const unitPrice =
      Number(item?.unit_price || 0) ||
      (qty > 0 ? Number((Number(item?.total_price || 0) / qty).toFixed(2)) : 0);
    const total = Number(item?.total_price || 0);
    const safeName = name.length > 52 ? `${name.slice(0, 49)}...` : name;
    const rowStart: [number, number, number] =
      rowIndex % 2 === 0 ? [248, 250, 252] : [241, 245, 249];
    const rowEnd: [number, number, number] =
      rowIndex % 2 === 0 ? [238, 242, 247] : [233, 238, 245];
    drawHorizontalGradient(doc, margin, y - 11, tableWidth, 18, rowStart, rowEnd, 24);
    doc.setDrawColor(...RECEIPT_COLORS.divider);
    doc.line(margin, y + 12, margin + tableWidth, y + 12);
    doc.text(safeName, margin + 10, y);
    doc.text(String(qty), qtyX, y);
    doc.text(Number(unitPrice).toFixed(2), priceX, y);
    doc.text(formatMoney(total, currency), totalX, y, { align: 'right' });
    y += 20;
    rowIndex += 1;
  });

  ensureSpace(190);
  y += 8;
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.line(margin, y, margin + tableWidth, y);
  y += 16;

  const labelX = margin + tableWidth - 160;
  const valueX = totalX;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Subtotal:', labelX, y, { align: 'right' });
  doc.text(formatMoney(subtotal, currency), valueX, y, { align: 'right' });
  y += 16;
  doc.text('Discount:', labelX, y, { align: 'right' });
  doc.text(formatMoney(discount, currency), valueX, y, { align: 'right' });
  y += 16;
  doc.text('Tax:', labelX, y, { align: 'right' });
  doc.text(formatMoney(tax, currency), valueX, y, { align: 'right' });
  y += 14;
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.line(margin, y, margin + tableWidth, y);
  y += 18;

  doc.setFillColor(...RECEIPT_COLORS.paper);
  doc.roundedRect(margin, y - 12, tableWidth, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14); // Totals typography
  doc.setTextColor(...RECEIPT_COLORS.text);
  doc.text('TOTAL:', labelX, y + 6, { align: 'right' });
  doc.text(formatMoney(total, currency), totalX, y + 6, { align: 'right' });
  y += 34;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...RECEIPT_COLORS.text);
  doc.text('Cash Paid:', labelX, y, { align: 'right' });
  doc.text(formatMoney(amountPaid, currency), totalX, y, { align: 'right' });
  y += 16;
  doc.text('Change:', labelX, y, { align: 'right' });
  doc.text(formatMoney(change, currency), totalX, y, { align: 'right' });
  y += 20;

  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.line(margin, y, margin + tableWidth, y);
  y += 16;

  // Payment confirmation section
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const method = paymentLabel.toLowerCase();
  if (method.includes('mobile')) {
    doc.text(`MoMo Ref: ${paymentReference || '-'}`, margin, y);
    y += 15;
    doc.text('Status: Successful', margin, y);
    doc.setTextColor(...RECEIPT_COLORS.text);
  } else if (method.includes('card')) {
    const masked = paymentReference ? `**** ${paymentReference.slice(-4)}` : '**** ----';
    doc.text(`Card: ${masked}`, margin, y);
    y += 15;
    doc.text(`Auth Code: ${authCode || '-'}`, margin, y);
  } else {
    doc.text('Status: Successful', margin, y);
    doc.setTextColor(...RECEIPT_COLORS.text);
  }
  y += 22;

  // QR verification section
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', margin, y, 68, 68);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...RECEIPT_COLORS.text);
    doc.text('Scan to verify this receipt', margin + 78, y + 24);
    const shortVerify = verifyUrl.length > 60 ? `${verifyUrl.slice(0, 57)}...` : verifyUrl;
    doc.text(shortVerify, margin + 78, y + 40);
    doc.setTextColor(...RECEIPT_COLORS.text);
    y += 80;
  }

  y += 6;
  doc.setDrawColor(...RECEIPT_COLORS.divider);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setTextColor(...RECEIPT_COLORS.text);
  doc.setFontSize(8.8); // Footer typography
  doc.text('Powered by ShopKeeper POS', margin, y);
  y += 13;
  doc.text('Transforming Retail in Ghana', margin, y);
  y += 13;
  doc.text('Developed by: Elinart', margin, y);
  doc.text(saleDate.toLocaleDateString(), pageWidth - margin, y, { align: 'right' });
  doc.setTextColor(...RECEIPT_COLORS.text);

  const blob = doc.output('blob');
  const filename = `receipt-${saleNumberShort.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { blob, file, filename };
}

export async function trySharePdfFile(file: File, title: string, text: string) {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (!nav.share) return false;
  if (nav.canShare && !nav.canShare({ files: [file] })) return false;
  await nav.share({ files: [file], title, text });
  return true;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
