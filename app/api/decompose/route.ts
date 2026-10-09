import { NextResponse } from "next/server";

import {
  decomposeImage,
  SeedreamApiError,
  SeedreamConfigError,
} from "@/lib/seedream";
import { MODEL_CHOICES, type ApiError, type DecomposeRequest } from "@/lib/types";

/** Allow the long synchronous Seedream call on platforms that honour this. */
export const maxDuration = 300;

const DATA_URL_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
/** 30 MB of raw image bytes is roughly 40 MB of base64 text. */
const MAX_DATA_URL_CHARS = 42 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2000;

function badRequest(error: string, details?: unknown) {
  return NextResponse.json<ApiError>({ error, details }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: Partial<DecomposeRequest>;
  try {
    payload = (await request.json()) as Partial<DecomposeRequest>;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const { imageDataUrl, model, prompt } = payload;

  if (typeof imageDataUrl !== "string" || !imageDataUrl) {
    return badRequest("imageDataUrl is required.");
  }
  if (imageDataUrl.length > MAX_DATA_URL_CHARS) {
    return badRequest("Image is too large. Please use a file under 30 MB.");
  }
  if (!DATA_URL_RE.test(imageDataUrl)) {
    return badRequest("imageDataUrl must be a base64 PNG or JPEG data URL.");
  }
  if (!model || !MODEL_CHOICES.includes(model)) {
    return badRequest(`model must be one of: ${MODEL_CHOICES.join(", ")}.`);
  }
  if (prompt !== undefined && typeof prompt !== "string") {
    return badRequest("prompt must be a string.");
  }
  if (prompt && prompt.length > MAX_PROMPT_CHARS) {
    return badRequest(`prompt must be under ${MAX_PROMPT_CHARS} characters.`);
  }

  try {
    const result = await decomposeImage({ imageDataUrl, model, prompt });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SeedreamConfigError) {
      return NextResponse.json<ApiError>({ error: err.message }, { status: 500 });
    }
    if (err instanceof SeedreamApiError) {
      return NextResponse.json<ApiError>(
        { error: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error("Unexpected error in /api/decompose", err);
    return NextResponse.json<ApiError>(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
