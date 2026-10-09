/**
 * Server-only helper for calling the Seedream image generation API in
 * layer-decomposition mode.
 *
 * API reference: https://docs.byteplus.com/en/docs/modelark/image-generation-api
 */
import "server-only";

import type {
  DecomposedLayer,
  DecomposeResponse,
  ModelChoice,
} from "./types";

// ---------- Upstream (Seedream) wire types ----------

interface SeedreamRequestBody {
  model: string;
  image: string;
  layer_decomposition: true;
  size: string;
  response_format: "b64_json";
  output_format: "png";
  watermark: boolean;
  prompt?: string;
}

interface SeedreamDataItem {
  url?: string;
  b64_json?: string;
  /** e.g. "2048x2048" */
  size?: string;
  output_format?: string;
  z_index: number;
  bounding_box?: {
    /** [left, top, right, bottom] in base-image pixels */
    absolute: [number, number, number, number];
    /** [left, top, right, bottom] on a 0-1000 scale */
    normalized: [number, number, number, number];
  };
  name?: string;
  description?: string;
}

interface SeedreamResponseBody {
  model: string;
  created: number;
  data?: SeedreamDataItem[];
  error?: { code?: string; message?: string };
  usage?: {
    input_images?: number;
    generated_images?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

// ---------- Config ----------

export class SeedreamConfigError extends Error {}

export class SeedreamApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getConfig() {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new SeedreamConfigError(
      "ARK_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  return {
    apiKey,
    baseUrl: (
      process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3"
    ).replace(/\/+$/, ""),
    models: {
      pro: process.env.SEEDREAM_MODEL_PRO ?? "dola-seedream-5-0-pro-260628",
      flash: process.env.SEEDREAM_MODEL_FLASH ?? "dola-seedream-5-0-flash-260915",
    } satisfies Record<ModelChoice, string>,
    size: process.env.SEEDREAM_SIZE ?? "1.5K",
  };
}

/** Layer decomposition is synchronous and can take 1-2 minutes. */
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

// ---------- Helpers ----------

function parseSize(size?: string): { width: number; height: number } | null {
  if (!size) return null;
  const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** Read width/height straight from PNG or JPEG bytes (fallback when `size` is missing). */
function readImageDimensions(
  base64: string
): { width: number; height: number } | null {
  const buf = Buffer.from(base64, "base64");
  // PNG: 8-byte signature, then IHDR chunk with width/height at offsets 16 and 20.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk the segment markers until a SOF marker.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      const segLen = buf.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segLen;
    }
  }
  return null;
}

function toDataUrl(item: SeedreamDataItem): string {
  if (!item.b64_json) {
    throw new SeedreamApiError(
      "Seedream returned an image without b64_json content.",
      502,
      item
    );
  }
  const mime = item.output_format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${item.b64_json}`;
}

function dimensionsOf(item: SeedreamDataItem) {
  return (
    parseSize(item.size) ??
    (item.b64_json ? readImageDimensions(item.b64_json) : null)
  );
}

// ---------- Public API ----------

export interface DecomposeParams {
  imageDataUrl: string;
  model: ModelChoice;
  prompt?: string;
}

/**
 * Call Seedream with layer_decomposition enabled and normalise the result
 * into the shape the frontend editor expects.
 */
export async function decomposeImage(
  params: DecomposeParams
): Promise<DecomposeResponse> {
  const cfg = getConfig();
  const modelId = cfg.models[params.model];

  const body: SeedreamRequestBody = {
    model: modelId,
    image: params.imageDataUrl,
    layer_decomposition: true,
    size: cfg.size,
    response_format: "b64_json",
    output_format: "png",
    watermark: false,
  };
  const prompt = params.prompt?.trim();
  if (prompt) body.prompt = prompt;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // Never cache: every call is a fresh, billable generation.
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new SeedreamApiError(
        `Seedream did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
        504
      );
    }
    throw new SeedreamApiError(
      `Could not reach Seedream: ${(err as Error).message}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }

  const elapsedMs = Date.now() - started;

  let json: SeedreamResponseBody;
  try {
    json = (await res.json()) as SeedreamResponseBody;
  } catch {
    throw new SeedreamApiError(
      `Seedream returned a non-JSON response (HTTP ${res.status}).`,
      502
    );
  }

  if (!res.ok || json.error) {
    const message =
      json.error?.message ?? `Seedream request failed with HTTP ${res.status}.`;
    throw new SeedreamApiError(message, res.ok ? 502 : res.status, json.error ?? json);
  }

  const items = json.data ?? [];
  const baseItem = items.find((d) => d.z_index === 0);
  if (!baseItem) {
    throw new SeedreamApiError(
      "Seedream response did not include a base image (z_index 0).",
      502,
      json
    );
  }

  const baseDims = dimensionsOf(baseItem);
  if (!baseDims) {
    throw new SeedreamApiError(
      "Could not determine the base image dimensions.",
      502,
      baseItem.size
    );
  }

  const layers: DecomposedLayer[] = items
    .filter((d) => d.z_index > 0)
    .sort((a, b) => a.z_index - b.z_index)
    .map((d, i) => {
      const dims = dimensionsOf(d) ?? { width: 0, height: 0 };
      const [left, top, right, bottom] = d.bounding_box?.absolute ?? [
        0,
        0,
        dims.width,
        dims.height,
      ];
      return {
        id: `layer-${d.z_index}-${i}`,
        name: d.name?.trim() || `Layer ${d.z_index}`,
        description: d.description?.trim() ?? "",
        zIndex: d.z_index,
        dataUrl: toDataUrl(d),
        width: dims.width,
        height: dims.height,
        bbox: { x: left, y: top, w: right - left, h: bottom - top },
      };
    });

  return {
    model: params.model,
    modelId,
    base: { dataUrl: toDataUrl(baseItem), ...baseDims },
    layers,
    usage: {
      generatedImages: json.usage?.generated_images,
      totalTokens: json.usage?.total_tokens,
    },
    elapsedMs,
  };
}
