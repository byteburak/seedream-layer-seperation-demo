"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApiError,
  DecomposeRequest,
  DecomposeResponse,
  ModelChoice,
} from "@/lib/types";
import {
  ImageValidationError,
  validateImageFile,
  type ValidatedImage,
} from "@/lib/validateImage";

interface UploadPanelProps {
  onResult: (result: DecomposeResponse, original: ValidatedImage) => void;
  /** Collapse the panel into a compact bar once a result is showing. */
  compact?: boolean;
}

interface ErrorState {
  message: string;
  details?: unknown;
}

const MODEL_OPTIONS: { value: ModelChoice; label: string; hint: string }[] = [
  { value: "pro", label: "Pro", hint: "best quality" },
  { value: "flash", label: "Flash", hint: "faster, cheaper" },
];

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export default function UploadPanel({ onResult, compact = false }: UploadPanelProps) {
  const [image, setImage] = useState<ValidatedImage | null>(null);
  const [model, setModel] = useState<ModelChoice>("pro");
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<ErrorState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Elapsed-time counter while waiting on Seedream.
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(id);
  }, [loading]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setImage(await validateImageFile(file));
    } catch (err) {
      setImage(null);
      setError({
        message:
          err instanceof ImageValidationError
            ? err.message
            : "Could not read that file. Please try another image.",
      });
    }
  }, []);

  const submit = useCallback(async () => {
    if (!image || loading) return;
    setElapsed(0);
    setLoading(true);
    setError(null);
    try {
      const body: DecomposeRequest = {
        imageDataUrl: image.dataUrl,
        model,
        prompt: prompt.trim() || undefined,
      };
      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as DecomposeResponse | ApiError;
      if (!res.ok || "error" in json) {
        const apiErr = json as ApiError;
        setError({
          message: apiErr.error ?? `Request failed with HTTP ${res.status}.`,
          details: apiErr.details,
        });
        return;
      }
      onResult(json, image);
    } catch (err) {
      setError({
        message: `Network error: ${(err as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [image, loading, model, prompt, onResult]);

  const canSubmit = Boolean(image) && !loading;

  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className={`grid gap-6 ${compact ? "md:grid-cols-[1fr_auto]" : "md:grid-cols-2"}`}>
        {/* Left: file picker */}
        <div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
              dragOver
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-500"
            } ${compact ? "min-h-24 p-3" : "min-h-56 p-6"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={loading}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {image ? (
              <div className="flex w-full items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt="Selected"
                  className={`rounded-lg object-contain ${
                    compact ? "h-16 w-16" : "h-40 w-40"
                  } bg-zinc-800`}
                />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-zinc-100">{image.file.name}</p>
                  <p className="text-zinc-400">
                    {image.width} x {image.height} px -{" "}
                    {(image.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Click or drop another file to replace it.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-base font-medium text-zinc-200">
                  Drop a photo here or click to choose
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  PNG or JPEG, 512x512 to 6000x6000 px, under 30 MB
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Right: controls */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Model
            </p>
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-1">
              {MODEL_OPTIONS.map((opt) => {
                const active = model === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setModel(opt.value)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-600 text-white shadow"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                    aria-pressed={active}
                  >
                    {opt.label}
                    <span
                      className={`ml-1.5 text-xs ${active ? "text-indigo-200" : "text-zinc-500"}`}
                    >
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Seedream 5.0 {model === "pro" ? "pro" : "flash"} will split the image into a
              base layer plus up to 16 editable layers.
            </p>
          </div>

          {!compact && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
              >
                {showAdvanced ? "Hide" : "Show"} advanced
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <label htmlFor="prompt" className="block text-sm text-zinc-300">
                    Guidance prompt (optional)
                  </label>
                  <textarea
                    id="prompt"
                    rows={3}
                    disabled={loading}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='e.g. "Decompose the person, the title text and the logo in the corner"'
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Leave empty to let the model pick the main elements automatically.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Separating layers... {formatElapsed(elapsed)}
                </>
              ) : (
                "Separate layers"
              )}
            </button>
            {loading && (
              <p className="mt-2 text-center text-xs text-zinc-500">
                This usually takes 1 to 2 minutes. Please keep this tab open.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          <p className="font-medium">{error.message}</p>
          {error.details !== undefined && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-300/80">
                Show raw API error
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 text-xs text-red-100">
                {typeof error.details === "string"
                  ? error.details
                  : JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
