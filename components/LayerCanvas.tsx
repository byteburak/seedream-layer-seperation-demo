"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Image as KonvaImage,
  Label,
  Layer,
  Rect,
  Stage,
  Tag,
  Text,
  Transformer,
} from "react-konva";

import type { EditableLayer } from "@/lib/editorState";
import type { LayerBox } from "@/lib/types";
import { useHtmlImage } from "@/lib/useHtmlImage";

export interface LayerCanvasHandle {
  /** Export the current composition as a PNG data URL at base-image resolution. */
  exportPng: () => string | null;
}

interface LayerCanvasProps {
  base: { dataUrl: string; width: number; height: number };
  layers: EditableLayer[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onChangeBox: (id: string, box: LayerBox) => void;
  ref?: Ref<LayerCanvasHandle>;
}

const MIN_SIZE = 8;

/** One draggable layer image. Kept separate so each can load its own bitmap. */
function LayerNode({
  layer,
  onSelect,
  onHover,
  onChangeBox,
  register,
}: {
  layer: EditableLayer;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onChangeBox: (id: string, box: LayerBox) => void;
  register: (id: string, node: Konva.Image | null) => void;
}) {
  const image = useHtmlImage(layer.dataUrl);
  const { box } = layer;

  const commit = useCallback(
    (node: Konva.Image) => {
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChangeBox(layer.id, {
        x: node.x(),
        y: node.y(),
        w: Math.max(MIN_SIZE, node.width() * sx),
        h: Math.max(MIN_SIZE, node.height() * sy),
      });
    },
    [layer.id, onChangeBox]
  );

  if (!image) return null;

  return (
    <KonvaImage
      ref={(node) => register(layer.id, node)}
      image={image}
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      visible={layer.visible}
      draggable
      onMouseEnter={() => onHover(layer.id)}
      onMouseLeave={() => onHover(null)}
      onMouseDown={() => onSelect(layer.id)}
      onTouchStart={() => onSelect(layer.id)}
      onDragStart={() => onSelect(layer.id)}
      onDragEnd={(e: KonvaEventObject<DragEvent>) => commit(e.target as Konva.Image)}
      onTransformEnd={(e: KonvaEventObject<Event>) => commit(e.target as Konva.Image)}
    />
  );
}

export default function LayerCanvas({
  base,
  layers,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onChangeBox,
  ref,
}: LayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMap = useRef(new Map<string, Konva.Image>());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const baseImage = useHtmlImage(base.dataUrl);

  // Track the available space so the canvas always fits.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale =
    containerSize.width > 0 && containerSize.height > 0
      ? Math.min(containerSize.width / base.width, containerSize.height / base.height)
      : 0;
  const stageWidth = Math.floor(base.width * scale);
  const stageHeight = Math.floor(base.height * scale);

  const register = useCallback((id: string, node: Konva.Image | null) => {
    if (node) nodeMap.current.set(id, node);
    else nodeMap.current.delete(id);
  }, []);

  // Attach the transformer to the selected layer.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? nodeMap.current.get(selectedId) : undefined;
    const selected = layers.find((l) => l.id === selectedId);
    tr.nodes(node && selected?.visible ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers]);

  useImperativeHandle(
    ref,
    () => ({
      exportPng: () => {
        const layer = contentLayerRef.current;
        const stage = layer?.getStage();
        if (!layer || !stage) return null;
        // Render at exactly base-image resolution: drop the view scale for the
        // duration of the export, then put it back. This is synchronous, so the
        // on-screen canvas never visibly changes.
        const prevScale = stage.scale();
        const prevSize = stage.size();
        stage.scale({ x: 1, y: 1 });
        stage.size({ width: base.width, height: base.height });
        try {
          return layer.toDataURL({
            x: 0,
            y: 0,
            width: base.width,
            height: base.height,
            pixelRatio: 1,
            mimeType: "image/png",
          });
        } finally {
          stage.scale(prevScale);
          stage.size(prevSize);
          stage.batchDraw();
        }
      },
    }),
    [base.width, base.height]
  );

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Click on the base image or empty space clears the selection.
    const target = e.target;
    if (target === target.getStage() || target.name() === "base") {
      onSelect(null);
    }
  };

  const highlightId = hoveredId ?? selectedId;
  const highlight = highlightId
    ? layers.find((l) => l.id === highlightId && l.visible)
    : undefined;

  // The overlay layer inherits the stage scale, so font/stroke sizes are
  // divided by scale to look constant on screen. (The Transformer positions
  // itself in absolute coordinates, so its sizes stay in plain pixels.)
  const px = (n: number) => (scale > 0 ? n / scale : n);

  return (
    <div
      ref={containerRef}
      className="checkerboard relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl"
      style={{ cursor: hoveredId ? "move" : "default" }}
    >
      {scale > 0 && (
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={handleStageMouseDown}
          onTouchStart={handleStageMouseDown}
        >
          <Layer ref={contentLayerRef}>
            {baseImage && (
              <KonvaImage
                name="base"
                image={baseImage}
                x={0}
                y={0}
                width={base.width}
                height={base.height}
                listening
              />
            )}
            {layers.map((layer) => (
              <LayerNode
                key={layer.id}
                layer={layer}
                onSelect={onSelect}
                onHover={onHover}
                onChangeBox={onChangeBox}
                register={register}
              />
            ))}
          </Layer>

          {/* Overlay: hover outline, name tag, resize handles. Not included in export. */}
          <Layer listening>
            {highlight && highlight.id !== selectedId && (
              <Rect
                x={highlight.box.x}
                y={highlight.box.y}
                width={highlight.box.w}
                height={highlight.box.h}
                stroke="#818cf8"
                strokeWidth={px(2)}
                dash={[px(6), px(4)]}
                listening={false}
              />
            )}
            {highlight && (
              <Label
                x={highlight.box.x}
                y={Math.max(0, highlight.box.y - px(26))}
                listening={false}
              >
                <Tag fill="#312e81" cornerRadius={px(4)} opacity={0.95} />
                <Text
                  text={highlight.name}
                  fontSize={px(13)}
                  fontFamily="system-ui, sans-serif"
                  fill="#e0e7ff"
                  padding={px(5)}
                />
              </Label>
            )}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              keepRatio
              shiftBehavior="default"
              anchorSize={10}
              anchorCornerRadius={2}
              anchorStroke="#6366f1"
              anchorFill="#eef2ff"
              borderStroke="#6366f1"
              borderStrokeWidth={2}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < MIN_SIZE || newBox.height < MIN_SIZE ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
