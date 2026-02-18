import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export const PRODUCT_BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load selected image.'));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawRegionToCanvas(
  image: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetWidth: number
): HTMLCanvasElement {
  const ratio = targetWidth / sw;
  const targetHeight = Math.max(1, Math.round(sh * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetWidth));
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function applyGrayscaleContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');

  ctx.drawImage(canvas, 0, 0);
  const frame = ctx.getImageData(0, 0, out.width, out.height);
  const d = frame.data;
  const contrast = 1.7;
  const midpoint = 128;

  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const adjusted = Math.max(0, Math.min(255, (gray - midpoint) * contrast + midpoint));
    d[i] = adjusted;
    d[i + 1] = adjusted;
    d[i + 2] = adjusted;
  }

  ctx.putImageData(frame, 0, 0);
  return out;
}

function applyThreshold(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');

  ctx.drawImage(canvas, 0, 0);
  const frame = ctx.getImageData(0, 0, out.width, out.height);
  const d = frame.data;
  const threshold = 130;

  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const bw = gray >= threshold ? 255 : 0;
    d[i] = bw;
    d[i + 1] = bw;
    d[i + 2] = bw;
  }

  ctx.putImageData(frame, 0, 0);
  return out;
}

async function canvasToPngFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Could not process image.'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });

  return new File([blob], name, { type: 'image/png' });
}

async function buildCandidateImages(file: File): Promise<File[]> {
  const image = await fileToImage(file);
  const w = image.width;
  const h = image.height;
  const candidates: File[] = [file];

  const full = drawRegionToCanvas(image, 0, 0, w, h, 1600);
  const fullGray = applyGrayscaleContrast(full);
  const fullBw = applyThreshold(fullGray);

  const centerBand = drawRegionToCanvas(
    image,
    0,
    Math.round(h * 0.35),
    w,
    Math.round(h * 0.4),
    1700
  );
  const bottomBand = drawRegionToCanvas(
    image,
    0,
    Math.round(h * 0.45),
    w,
    Math.round(h * 0.55),
    1800
  );

  const centerCrop = drawRegionToCanvas(
    image,
    Math.round(w * 0.1),
    Math.round(h * 0.2),
    Math.round(w * 0.8),
    Math.round(h * 0.6),
    1700
  );
  const centerCropGray = applyGrayscaleContrast(centerCrop);
  const bottomBandGray = applyGrayscaleContrast(bottomBand);

  candidates.push(await canvasToPngFile(full, 'barcode-full.png'));
  candidates.push(await canvasToPngFile(fullGray, 'barcode-full-gray.png'));
  candidates.push(await canvasToPngFile(fullBw, 'barcode-full-bw.png'));
  candidates.push(await canvasToPngFile(centerBand, 'barcode-center-band.png'));
  candidates.push(await canvasToPngFile(bottomBand, 'barcode-bottom-band.png'));
  candidates.push(await canvasToPngFile(centerCrop, 'barcode-center-crop.png'));
  candidates.push(await canvasToPngFile(centerCropGray, 'barcode-center-crop-gray.png'));
  candidates.push(await canvasToPngFile(bottomBandGray, 'barcode-bottom-band-gray.png'));

  return candidates;
}

export async function decodeBarcodeFromImageFile(file: File, elementId: string): Promise<string> {
  const scanner = new Html5Qrcode(elementId, { formatsToSupport: PRODUCT_BARCODE_FORMATS, verbose: false });
  let lastError: unknown = null;

  try {
    const candidates = await buildCandidateImages(file);
    for (const candidate of candidates) {
      try {
        const decoded = await scanner.scanFile(candidate, false);
        if (decoded?.trim()) {
          return decoded.trim();
        }
      } catch (error) {
        lastError = error;
      }
    }
  } finally {
    try {
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
  }

  throw lastError || new Error('Could not read barcode from image.');
}
