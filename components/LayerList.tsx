"use client";

import type { EditableLayer } from "@/lib/editorState";

interface LayerListProps {
  layers: EditableLayer[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onToggleVisible: (id: string) => void;
  onMove: (id: string, direction: "forward" | "backward") => void;
  onReset: () => void;
  onDownload: () => void;
}

export default function LayerList({
  layers,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onToggleVisible,
  onMove,
  onReset,
  onDownload,
}: LayerListProps) {
  // Show top-most layer first, like a design tool's layer panel.
  const ordered = [...layers].reverse();
  const hiddenCount = layers.filter((l) => !l.visible).length;

  return (
    <aside className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Layers <span className="text-zinc-500">({layers.length})</span>
          </h2>
          {hiddenCount > 0 && (
            <p className="text-xs text-zinc-500">{hiddenCount} hidden</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Reset layout
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {ordered.map((layer, i) => {
          const isTop = i === 0;
          const isBottom = i === ordered.length - 1;
          const active = layer.id === selectedId;
          const hovered = layer.id === hoveredId;
          return (
            <li key={layer.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(layer.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(layer.id);
                  }
                }}
                onMouseEnter={() => onHover(layer.id)}
                onMouseLeave={() => onHover(null)}
                className={`group mb-1 flex cursor-pointer items-start gap-3 rounded-lg border p-2 transition ${
                  active
                    ? "border-indigo-500 bg-indigo-500/10"
                    : hovered
                      ? "border-zinc-600 bg-zinc-800/60"
                      : "border-transparent hover:bg-zinc-800/40"
                } ${layer.visible ? "" : "opacity-50"}`}
              >
                <div className="checkerboard h-12 w-12 shrink-0 overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={layer.dataUrl}
                    alt={layer.name}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {layer.name}
                  </p>
                  {layer.description && (
                    <p className="line-clamp-2 text-xs text-zinc-400">
                      {layer.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {Math.round(layer.box.w)} x {Math.round(layer.box.h)} px at (
                    {Math.round(layer.box.x)}, {Math.round(layer.box.y)})
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <IconButton
                    label={layer.visible ? "Hide layer" : "Show layer"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisible(layer.id);
                    }}
                  >
                    {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                  </IconButton>
                  <div className="flex gap-1">
                    <IconButton
                      label="Bring forward"
                      disabled={isTop}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "forward");
                      }}
                    >
                      <ChevronUpIcon />
                    </IconButton>
                    <IconButton
                      label="Send backward"
                      disabled={isBottom}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(layer.id, "backward");
                      }}
                    >
                      <ChevronDownIcon />
                    </IconButton>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {layers.length === 0 && (
          <li className="p-4 text-center text-sm text-zinc-500">
            No separate layers were returned for this image.
          </li>
        )}
      </ul>

      <div className="border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={onDownload}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
        >
          Download composition (PNG)
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Tip: click a layer to select it, drag to move, use the handles to resize.
          Delete hides the selected layer.
        </p>
      </div>
    </aside>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.2 6.2C3.6 8 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.3-1" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
