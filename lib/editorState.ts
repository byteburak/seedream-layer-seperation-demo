import type { DecomposedLayer, LayerBox } from "./types";

/** A layer plus the editable state the canvas works with. */
export interface EditableLayer extends DecomposedLayer {
  /** Current position/size on the canvas (starts equal to `bbox`). */
  box: LayerBox;
  visible: boolean;
}

/** Build the initial editor state from the API response, bottom-most first. */
export function toEditableLayers(layers: DecomposedLayer[]): EditableLayer[] {
  return [...layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((l) => ({ ...l, box: { ...l.bbox }, visible: true }));
}

export function resetLayers(layers: EditableLayer[]): EditableLayer[] {
  return toEditableLayers(layers);
}

export function updateBox(
  layers: EditableLayer[],
  id: string,
  box: LayerBox
): EditableLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, box } : l));
}

export function toggleVisible(layers: EditableLayer[], id: string): EditableLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
}

export function setVisible(
  layers: EditableLayer[],
  id: string,
  visible: boolean
): EditableLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, visible } : l));
}

/** Move a layer one step up (towards the viewer) or down in the stack. */
export function moveLayer(
  layers: EditableLayer[],
  id: string,
  direction: "forward" | "backward"
): EditableLayer[] {
  const index = layers.findIndex((l) => l.id === id);
  if (index === -1) return layers;
  const target = direction === "forward" ? index + 1 : index - 1;
  if (target < 0 || target >= layers.length) return layers;
  const next = [...layers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
