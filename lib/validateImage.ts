/**
 * Client-side checks that mirror Seedream's input limits for layer decomposition:
 * one PNG or JPEG, 512x512 to 6000x6000 total pixels, under 30 MB.
 */

export const IMAGE_LIMITS = {
  mimeTypes: ["image/png", "image/jpeg"],
  maxBytes: 30 * 1024 * 1024,
  minPixels: 512 * 512,
  maxPixels: 6000 * 6000,
  minAspect: 1 / 16,
  maxAspect: 16,
} as const;

export interface ValidatedImage {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export class ImageValidationError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function loadDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("The file is not a readable image."));
    img.src = dataUrl;
  });
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (!IMAGE_LIMITS.mimeTypes.includes(file.type as (typeof IMAGE_LIMITS.mimeTypes)[number])) {
    throw new ImageValidationError("Please choose a PNG or JPEG image.");
  }
  if (file.size > IMAGE_LIMITS.maxBytes) {
    throw new ImageValidationError(
      `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 30 MB.`
    );
  }

  const dataUrl = await readAsDataUrl(file);
  const { width, height } = await loadDimensions(dataUrl);
  const pixels = width * height;
  const aspect = width / height;

  if (pixels < IMAGE_LIMITS.minPixels) {
    throw new ImageValidationError(
      `The image is ${width}x${height}; it needs at least as many pixels as 512x512.`
    );
  }
  if (pixels > IMAGE_LIMITS.maxPixels) {
    throw new ImageValidationError(
      `The image is ${width}x${height}; it may not exceed 6000x6000 pixels.`
    );
  }
  if (aspect < IMAGE_LIMITS.minAspect || aspect > IMAGE_LIMITS.maxAspect) {
    throw new ImageValidationError(
      "The aspect ratio must be between 1:16 and 16:1."
    );
  }

  return { file, dataUrl, width, height };
}
