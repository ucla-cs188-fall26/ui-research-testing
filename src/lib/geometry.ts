import Konva from "konva";
import type { ArrowEnd, Side, WireframeElement } from "../api/wireframe";

export interface Point {
  x: number;
  y: number;
}

export interface SnapResult {
  elementId: string;
  side: Side;
  point: Point; // where the arrow end lands, in document coordinates
}

const SIDES: Side[] = ["top", "right", "bottom", "left"];

/* -------------------------------------------------------------------------- */
/*  Sizes                                                                     */
/* -------------------------------------------------------------------------- */

// Text height depends on wrapping, so it is measured rather than stored.
const textHeights = new Map<string, number>();

export function elementSize(el: WireframeElement): {
  width: number;
  height: number;
} {
  if (el.type !== "text") return { width: el.width, height: el.height };

  const fontSize = el.fontSize ?? 24;
  const key = `${fontSize}|${el.width}|${el.text ?? ""}`;
  let h = textHeights.get(key);
  if (h === undefined) {
    if (textHeights.size > 500) textHeights.clear();
    h = new Konva.Text({
      text: el.text ?? "",
      fontSize,
      width: el.width,
    }).height();
    textHeights.set(key, h);
  }
  return { width: el.width, height: h };
}

/* -------------------------------------------------------------------------- */
/*  Anchors                                                                   */
/* -------------------------------------------------------------------------- */

function localAnchor(w: number, h: number, side: Side): Point {
  switch (side) {
    case "top":
      return { x: w / 2, y: 0 };
    case "right":
      return { x: w, y: h / 2 };
    case "bottom":
      return { x: w / 2, y: h };
    case "left":
      return { x: 0, y: h / 2 };
  }
}

// Midpoint of one side of an element, in document coordinates.
// Konva rotates every shape around its top-left (x, y), so we do the same.
export function anchorPoint(el: WireframeElement, side: Side): Point {
  const { width: w, height: h } = elementSize(el);
  const l = localAnchor(w, h, side);
  const r = ((el.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: el.x + l.x * cos - l.y * sin,
    y: el.y + l.x * sin + l.y * cos,
  };
}

export function sidesOf(el: WireframeElement): { side: Side; point: Point }[] {
  return SIDES.map((side) => ({ side, point: anchorPoint(el, side) }));
}

// Where an arrow end actually is: the live anchor if attached, else its stored point.
export function resolveEnd(
  end: ArrowEnd,
  elements: Record<string, WireframeElement>,
): Point {
  if (end.elementId && end.side) {
    const target = elements[end.elementId];
    if (target) return anchorPoint(target, end.side);
  }
  return { x: end.x, y: end.y };
}

export function makeEnd(snap: SnapResult | null, p: Point): ArrowEnd {
  return snap
    ? {
        x: snap.point.x,
        y: snap.point.y,
        elementId: snap.elementId,
        side: snap.side,
      }
    : { x: p.x, y: p.y };
}

/* -------------------------------------------------------------------------- */
/*  Snapping                                                                  */
/* -------------------------------------------------------------------------- */

// Finds the topmost element near the pointer and returns its nearest side midpoint.
// `scale` is the stage zoom, so the snap margin stays ~14px on screen.
export function findSnap(
  p: Point,
  elements: Record<string, WireframeElement>,
  order: string[],
  scale: number,
): SnapResult | null {
  const margin = 14 / scale;

  for (let i = order.length - 1; i >= 0; i--) {
    const el = elements[order[i]];
    if (!el || el.type === "arrow" || el.type === "line") continue;

    const { width: w, height: h } = elementSize(el);

    // Pointer in the element's own (unrotated) space
    const r = (-(el.rotation ?? 0) * Math.PI) / 180;
    const dx = p.x - el.x;
    const dy = p.y - el.y;
    const lx = dx * Math.cos(r) - dy * Math.sin(r);
    const ly = dx * Math.sin(r) + dy * Math.cos(r);

    if (lx < -margin || lx > w + margin || ly < -margin || ly > h + margin)
      continue;

    // Frames are big containers: only snap near their border, not anywhere inside
    if (
      el.type === "frame" &&
      lx > margin * 2 &&
      lx < w - margin * 2 &&
      ly > margin * 2 &&
      ly < h - margin * 2
    ) {
      continue;
    }

    let best: Side = "top";
    let bestDist = Infinity;
    for (const side of SIDES) {
      const a = localAnchor(w, h, side);
      const d = Math.hypot(lx - a.x, ly - a.y);
      if (d < bestDist) {
        bestDist = d;
        best = side;
      }
    }
    return { elementId: el.id, side: best, point: anchorPoint(el, best) };
  }

  return null;
}
