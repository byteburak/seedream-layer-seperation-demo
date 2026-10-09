"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  moveLayer,
  resetLayers,
  setVisible,
  toEditableLayers,
  toggleVisible,
  updateBox,
  type EditableLayer,
} from "@/lib/editorState";
import type { DecomposeResponse, LayerBox } from "@/lib/types";
import type { ValidatedImage } from "@/lib/validateImage";

import type { LayerCanvasHandle } from "./LayerCanvas";
import LayerList from "./LayerList";

// Konva touches `window`, so the canvas must only render in the browser.
const LayerCanvas = dynamic(() => import("./LayerCanvas"), {
  ssr: false,
  loading: () => (
    <div className="checkerboard flex h-full w-full items-center justify-center rounded-xl text-sm text-zinc-400">
      Loading canvas...
    </div>
  ),
});

interface EditorProps {
  result: DecomposeResponse;
  original: ValidatedImage;
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function Editor({ result, original }: EditorProps) {
  const [layers, setLayers] = useState<EditableLayer[]>(() =>
    toEditableLayers(result.layers)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef<LayerCanvasHandle>(null);
  // Note: the page remounts this component (via `key`) for each new result,
  // so the state above is always fresh for a new decomposition.

  const handleChangeBox = useCallback((id: string, box: LayerBox) => {
    setLayers((prev) => updateBox(prev, id, box));
  }, []);

  const handleToggleVisible = useCallback((id: string) => {
    setLayers((prev) => toggleVisible(prev, id));
  }, []);

  const handleMove = useCallback((id: string, direction: "forward" | "backward") => {
    setLayers((prev) => moveLayer(prev, id, direction));
  }, []);

  const handleReset = useCallback(() => {
    setLayers((prev) => resetLayers(prev));
    setSelectedId(null);
  }, []);

  const handleDownload = useCallback(() => {
    const dataUrl = canvasRef.current?.exportPng();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `seedream-layers-${result.model}-${Date.now()}.png`;
    a.click();
  }, [result.model]);

  // Keyboard: Delete/Backspace hides the selected layer, Escape deselects.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setLayers((prev) => setVisible(prev, selectedId, false));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  return (
    <section className="flex flex-1 flex-col gap-3">
      {/* Result header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              Seedream 5.0 {result.model}
            </span>
            <span className="font-mono text-xs text-zinc-500">{result.modelId}</span>
          </span>
          <span className="text-zinc-300">
            <strong className="text-zinc-100">{result.layers.length}</strong> layers detected
          </span>
          <span className="text-zinc-300">
            Base <strong className="text-zinc-100">{result.base.width} x {result.base.height}</strong> px
          </span>
          <span className="text-zinc-300">
            Took <strong className="text-zinc-100">{formatDuration(result.elapsedMs)}</strong>
          </span>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showOriginal}
            onChange={(e) => setShowOriginal(e.target.checked)}
            className="h-4 w-4 accent-indigo-500"
          />
          Show original
        </label>
      </div>

      {/* Canvas + side panel */}
      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div
          className={`grid min-h-[60vh] gap-3 ${showOriginal ? "md:grid-cols-2" : ""}`}
        >
          {showOriginal && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Original
              </p>
              <div className="checkerboard flex flex-1 items-center justify-center overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={original.dataUrl}
                  alt="Original upload"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {showOriginal && (
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Editable layers
              </p>
            )}
            <div className="min-h-[50vh] flex-1">
              <LayerCanvas
                ref={canvasRef}
                base={result.base}
                layers={layers}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={setSelectedId}
                onHover={setHoveredId}
                onChangeBox={handleChangeBox}
              />
            </div>
          </div>
        </div>

        <div className="max-h-[80vh] lg:max-h-none">
          <LayerList
            layers={layers}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            onToggleVisible={handleToggleVisible}
            onMove={handleMove}
            onReset={handleReset}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </section>
  );
}
