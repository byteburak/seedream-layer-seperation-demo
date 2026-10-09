/**
 * Types shared between the browser and the server.
 * Keep this file free of server-only imports.
 */

/** The two Seedream 5.0 variants that support layer decomposition. */
export type ModelChoice = "pro" | "flash";

export const MODEL_CHOICES: ModelChoice[] = ["pro", "flash"];

/** What the browser sends to POST /api/decompose. */
export interface DecomposeRequest {
  /** Image as a data URL, e.g. "data:image/png;base64,...." */
  imageDataUrl: string;
  model: ModelChoice;
  /** Optional hint telling the model which elements to separate. */
  prompt?: string;
}

/** Position and size of a layer in base-image pixel coordinates. */
export interface LayerBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DecomposedLayer {
  id: string;
  name: string;
  description: string;
  zIndex: number;
  /** Transparent PNG as a data URL. */
  dataUrl: string;
  /** Intrinsic pixel size of the layer PNG. */
  width: number;
  height: number;
  /** Where the layer sits on the base image. */
  bbox: LayerBox;
}

export interface DecomposeResponse {
  model: ModelChoice;
  modelId: string;
  base: {
    dataUrl: string;
    width: number;
    height: number;
  };
  layers: DecomposedLayer[];
  usage?: {
    generatedImages?: number;
    totalTokens?: number;
  };
  /** Server-side wall-clock time for the Seedream call, in milliseconds. */
  elapsedMs: number;
}

export interface ApiError {
  error: string;
  /** Raw upstream error payload, useful for debugging during demos. */
  details?: unknown;
}
