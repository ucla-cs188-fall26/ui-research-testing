// components/Canvas.tsx
import {
  Stage,
  Layer,
  Rect,
  Ellipse,
  Line,
  Arrow,
  Circle,
  Text,
  Transformer,
} from "react-konva";
import { useRef, useEffect, useState } from "react";
import Konva from "konva";
import { useEditor } from "../store/editorStore";
import { useCommentStore } from "../store/commentStore";
import { stageRef as sharedStageRef } from "../lib/stageRef";
import { findSnap, makeEnd, resolveEnd, sidesOf } from "../lib/geometry.ts";
import type { SnapResult } from "../lib/geometry.ts";
import { CommentPins } from "./feedback/CommentPins";
import { TextEditor } from "./TextEditor.tsx";
import type { Comment } from "../api/comments";
import type {
  ArrowEnd,
  ElementType,
  Side,
  WireframeElement,
} from "../api/wireframe";

const DRAW_TOOLS = ["rect", "ellipse", "text", "line", "frame", "arrow"];
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

type Gesture =
  | { kind: "draw"; id: string; startX: number; startY: number }
  | { kind: "arrow-pending"; start: ArrowEnd; from: { x: number; y: number } }
  | {
      kind: "endpoint";
      id: string;
      which: "start" | "end";
      moved: boolean;
      fromTool: boolean;
    }
  | { kind: "marquee"; startX: number; startY: number; base: string[] };

/* -------------------------------------------------------------------------- */
/*  Dragging (supports moving every selected element together)                */
/* -------------------------------------------------------------------------- */

// Only one canvas is on screen at a time, so a module-level session is fine.
type DragSession = {
  anchorId: string;
  origin: { x: number; y: number };
  snaps: Record<string, WireframeElement>;
};
let dragSession: DragSession | null = null;

const shift = (end: ArrowEnd, dx: number, dy: number): ArrowEnd => ({
  ...end,
  x: end.x + dx,
  y: end.y + dy,
});

function beginDrag(el: WireframeElement) {
  const s = useEditor.getState();
  s.commit(); // one undo step for the whole drag
  const ids = s.selectedIds.includes(el.id) ? s.selectedIds : [el.id];
  const snaps: Record<string, WireframeElement> = {};
  for (const id of ids) {
    const e = s.doc.elements[id];
    if (e) snaps[id] = e;
  }
  dragSession = {
    anchorId: el.id,
    // arrow nodes sit at (0,0); their points carry the position
    origin: el.type === "arrow" ? { x: 0, y: 0 } : { x: el.x, y: el.y },
    snaps,
  };
}

function moveDrag(node: Konva.Node) {
  const d = dragSession;
  if (!d) return;
  const dx = node.x() - d.origin.x;
  const dy = node.y() - d.origin.y;
  const { updateElement } = useEditor.getState();

  for (const [id, snap] of Object.entries(d.snaps)) {
    if (snap.type === "arrow") {
      if (id === d.anchorId) continue; // Konva moves it; applied in endDrag
      if (snap.start?.elementId || snap.end?.elementId) continue; // attached: follows its elements
      if (snap.start && snap.end) {
        updateElement(id, {
          start: shift(snap.start, dx, dy),
          end: shift(snap.end, dx, dy),
        });
      }
      continue;
    }
    updateElement(id, { x: snap.x + dx, y: snap.y + dy });
  }
}

function endDrag(node: Konva.Node) {
  const d = dragSession;
  if (!d) return;
  moveDrag(node);

  const anchor = d.snaps[d.anchorId];
  if (anchor?.type === "arrow" && anchor.start && anchor.end) {
    const dx = node.x();
    const dy = node.y();
    node.position({ x: 0, y: 0 });
    useEditor.getState().updateElement(anchor.id, {
      start: shift(anchor.start, dx, dy),
      end: shift(anchor.end, dx, dy),
    });
  }
  dragSession = null;
}

function selectOnMouseDown(
  id: string,
  e: Konva.KonvaEventObject<MouseEvent>,
  enabled: boolean,
) {
  if (!enabled) return;
  const s = useEditor.getState();
  if (e.evt.shiftKey) {
    s.select(
      s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    );
  } else if (!s.selectedIds.includes(id)) {
    s.select([id]);
  }
}

/* -------------------------------------------------------------------------- */
/*  ElementNode: renders one document element as a Konva shape                */
/* -------------------------------------------------------------------------- */

function ElementNode({
  el,
  readOnly,
  hidden,
  onEditText,
}: {
  el: WireframeElement;
  readOnly: boolean;
  hidden: boolean;
  onEditText: (id: string) => void;
}) {
  const tool = useEditor((s) => s.tool);
  const updateElement = useEditor((s) => s.updateElement);

  const interactive = !readOnly && tool === "select";

  const common = {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation ?? 0,
    stroke: el.stroke ?? "#000000",
    strokeWidth: el.strokeWidth ?? 2,
    strokeScaleEnabled: false, // keep stroke thickness constant while resizing
    listening: !readOnly, // read-only shapes let clicks fall through to the stage
    draggable: interactive,
    visible: !hidden,

    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) =>
      selectOnMouseDown(el.id, e, interactive),
    onDragStart: () => beginDrag(el),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => moveDrag(e.target),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => endDrag(e.target),

    // Konva resizes by changing scale. Bake it into width/height and reset to 1
    // so the saved document stays clean. (The Transformer commits history once.)
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const sx = Math.abs(node.scaleX());
      const sy = Math.abs(node.scaleY());
      node.scaleX(1);
      node.scaleY(1);

      const patch: Partial<WireframeElement> = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(5, el.width * sx),
        height: Math.max(5, el.height * sy),
      };
      if (el.type === "line") {
        const pts = el.points ?? [0, 0, el.width, el.height];
        patch.points = pts.map((p, i) => (i % 2 === 0 ? p * sx : p * sy));
      }
      if (el.type === "text") {
        patch.height = el.height; // text height is measured, not stored
        patch.fontSize = Math.max(8, Math.round((el.fontSize ?? 24) * sy));
      }
      updateElement(el.id, patch);
    },
  };

  const fill = el.fill ?? "#ffffff";

  switch (el.type) {
    case "rect":
    case "frame":
      return (
        <Rect {...common} fill={fill} width={el.width} height={el.height} />
      );

    case "ellipse":
      // Ellipses are positioned by their center in Konva; the offset makes
      // x/y the top-left corner so they behave like rects.
      return (
        <Ellipse
          {...common}
          fill={fill}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          offsetX={-el.width / 2}
          offsetY={-el.height / 2}
        />
      );

    case "line":
      return (
        <Line
          {...common}
          points={el.points ?? [0, 0, el.width, el.height]}
          lineCap="round"
          hitStrokeWidth={12}
        />
      );

    case "text":
      // For text, `fill` is the text color and there is no outline
      return (
        <Text
          {...common}
          stroke={undefined}
          strokeWidth={0}
          fill={fill}
          text={el.text ?? ""}
          fontSize={el.fontSize ?? 24}
          width={el.width}
          onDblClick={() => interactive && onEditText(el.id)}
          onDblTap={() => interactive && onEditText(el.id)}
        />
      );

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  ArrowNode: an arrow whose ends follow the elements it is attached to      */
/* -------------------------------------------------------------------------- */

function ArrowNode({
  el,
  elements,
  readOnly,
  selected,
}: {
  el: WireframeElement;
  elements: Record<string, WireframeElement>;
  readOnly: boolean;
  selected: boolean;
}) {
  const tool = useEditor((s) => s.tool);
  const interactive = !readOnly && tool === "select";

  const a = resolveEnd(el.start ?? { x: 0, y: 0 }, elements);
  const b = resolveEnd(el.end ?? { x: 0, y: 0 }, elements);
  const free = !el.start?.elementId && !el.end?.elementId;
  const color = selected ? "#2563eb" : (el.stroke ?? "#111111");

  return (
    <Arrow
      id={el.id}
      x={0}
      y={0}
      points={[a.x, a.y, b.x, b.y]}
      stroke={color}
      fill={color}
      strokeWidth={el.strokeWidth ?? 2}
      strokeScaleEnabled={false}
      pointerLength={10}
      pointerWidth={10}
      lineCap="round"
      hitStrokeWidth={14}
      listening={!readOnly}
      // Only arrows with no attached ends can be dragged as a whole
      draggable={interactive && free}
      onMouseDown={(e) => selectOnMouseDown(el.id, e, interactive)}
      onDragStart={() => beginDrag(el)}
      onDragMove={(e) => moveDrag(e.target)}
      onDragEnd={(e) => endDrag(e.target)}
    />
  );
}

// Dots on the four sides of the element an arrow is about to attach to
function SnapAnchors({
  el,
  active,
  scale,
}: {
  el: WireframeElement;
  active: Side;
  scale: number;
}) {
  return (
    <>
      {sidesOf(el).map(({ side, point }) => (
        <Circle
          key={side}
          x={point.x}
          y={point.y}
          radius={(side === active ? 6 : 4) / scale}
          fill={side === active ? "#2563eb" : "#ffffff"}
          stroke="#2563eb"
          strokeWidth={1.5 / scale}
          listening={false}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Canvas                                                                    */
/* -------------------------------------------------------------------------- */

export function Canvas({
  readOnly = false,
  comments,
}: {
  readOnly?: boolean;
  comments?: Comment[];
}) {
  const doc = useEditor((s) => s.doc);
  const selectedIds = useEditor((s) => s.selectedIds);
  const tool = useEditor((s) => s.tool);
  const select = useEditor((s) => s.select);
  const addElement = useEditor((s) => s.addElement);
  const updateElement = useEditor((s) => s.updateElement);
  const setTool = useEditor((s) => s.setTool);

  const commentMode = useCommentStore((s) => s.commentMode);
  const setDraftPin = useCommentStore((s) => s.setDraftPin);

  const containerRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const [scale, setScale] = useState(1); // zoom, tracked so overlays keep their on-screen size
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [snap, setSnap] = useState<{ elementId: string; side: Side } | null>(
    null,
  );

  const updateSnap = (s: SnapResult | null) =>
    setSnap((prev) => {
      const next = s ? { elementId: s.elementId, side: s.side } : null;
      return prev?.elementId === next?.elementId && prev?.side === next?.side
        ? prev
        : next;
    });

  // Size the stage to its container (so it fits next to the comments sidebar)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Attach transformer to selected shapes (arrows use endpoint handles instead)
  useEffect(() => {
    const stage = stageRef.current;
    if (readOnly || !stage || !trRef.current) return;
    const nodes = selectedIds
      .filter(
        (id) =>
          doc.elements[id] &&
          doc.elements[id].type !== "arrow" &&
          id !== editingId,
      )
      .map((id) => stage.findOne("#" + id))
      .filter(Boolean) as Konva.Node[];
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedIds, doc, readOnly, editingId]);

  // Cursor feedback
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    if (readOnly) {
      container.style.cursor = commentMode ? "crosshair" : "grab";
    } else if (tool === "hand") {
      container.style.cursor = "grab";
    } else {
      container.style.cursor = tool === "select" ? "default" : "crosshair";
    }
  }, [readOnly, commentMode, tool]);

  // Leaving the arrow tool clears its snap hint
  useEffect(() => {
    if (tool !== "arrow" && !gesture.current) setSnap(null);
  }, [tool]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }

      if (readOnly) {
        if (e.key === "Escape")
          useCommentStore.getState().setCommentMode(false);
        return;
      }

      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "a") {
        e.preventDefault();
        s.select([...s.doc.order]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedIds.length) {
          e.preventDefault();
          s.deleteSelected();
        }
      } else if (e.key === "Escape") {
        s.select([]);
        s.setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly]);

  // Pointer position in document coordinates (accounts for pan/zoom)
  const pointer = () => {
    const stage = stageRef.current!;
    const pos = stage.getRelativePointerPosition() ?? { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pos);
  };

  const finishEditing = (id: string, value: string) => {
    setEditingId(null);
    const s = useEditor.getState();
    const current = s.doc.elements[id];
    if (!current) return;
    if (!value.trim()) {
      // Clearing a text box deletes it
      s.select([id]);
      s.deleteSelected();
      return;
    }
    if (value !== (current.text ?? ""))
      s.updateElement(id, { text: value }, true);
    s.select([id]);
  };

  /* ------------------------------ gestures ------------------------------- */

  const finishGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    setMarquee(null);
    setSnap(null);
    if (!g) return;

    if (g.kind === "draw") {
      // A plain click (no drag) gets a sensible default size
      const el = useEditor.getState().doc.elements[g.id];
      if (el && el.width < 5 && el.height < 5) {
        updateElement(
          g.id,
          el.type === "line"
            ? { width: 100, height: 1, points: [0, 0, 100, 0] }
            : { width: 120, height: 80 },
        );
      }
      setTool("select");
    } else if (g.kind === "endpoint" && g.fromTool) {
      setTool("select");
    }
  };

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Viewer: in comment mode, a click drops a draft pin
    if (readOnly) {
      if (commentMode) setDraftPin(pointer());
      return;
    }
    if (editingId) return; // the text editor commits on blur

    if (tool === "select") {
      // Dragging on empty canvas draws a selection rectangle
      if (e.target === e.target.getStage()) {
        const p = pointer();
        const base = e.evt.shiftKey ? useEditor.getState().selectedIds : [];
        if (!e.evt.shiftKey) select([]);
        gesture.current = { kind: "marquee", startX: p.x, startY: p.y, base };
      }
      return;
    }

    if (tool === "arrow") {
      const p = pointer();
      const hit = findSnap(p, doc.elements, doc.order, scale);
      gesture.current = {
        kind: "arrow-pending",
        start: makeEnd(hit, p),
        from: p,
      };
      return;
    }

    if (!DRAW_TOOLS.includes(tool)) return; // e.g. the hand tool

    const { x, y } = pointer();

    // Text is placed with a click, then edited right away
    if (tool === "text") {
      e.evt.preventDefault(); // keep focus for the editor that is about to open
      const id = addElement({
        type: "text",
        x,
        y,
        width: 160,
        height: 24,
        text: "Text",
        fontSize: 24,
        fill: "#111111",
        strokeWidth: 0,
      });
      setTool("select");
      setEditingId(id);
      return;
    }

    const id = addElement({
      type: tool as ElementType,
      x,
      y,
      width: 1,
      height: 1,
      ...(tool === "line" ? { points: [0, 0, 0, 0] } : {}),
    });
    gesture.current = { kind: "draw", id, startX: x, startY: y };
  };

  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly) return;
    const g = gesture.current;

    // Show attach points while hovering with the arrow tool
    if (!g) {
      if (tool === "arrow") {
        updateSnap(findSnap(pointer(), doc.elements, doc.order, scale));
      }
      return;
    }

    // Button was released outside the canvas: finish the gesture
    if (e.evt.buttons === 0) {
      finishGesture();
      return;
    }

    const p = pointer();

    switch (g.kind) {
      case "marquee": {
        const box = {
          x: Math.min(p.x, g.startX),
          y: Math.min(p.y, g.startY),
          width: Math.abs(p.x - g.startX),
          height: Math.abs(p.y - g.startY),
        };
        if (Math.max(box.width, box.height) * scale < 3) return; // ignore plain clicks
        setMarquee(box);

        const stage = stageRef.current!;
        const layer = stage.getLayers()[0];
        const hits = doc.order.filter((id) => {
          const node = stage.findOne("#" + id);
          return node
            ? Konva.Util.haveIntersection(
                box,
                node.getClientRect({ relativeTo: layer }),
              )
            : false;
        });
        const next = Array.from(new Set([...g.base, ...hits]));
        const cur = useEditor.getState().selectedIds;
        if (next.length !== cur.length || next.some((id) => !cur.includes(id)))
          select(next);
        return;
      }

      case "draw": {
        const { id, startX, startY } = g;
        if (useEditor.getState().doc.elements[id]?.type === "line") {
          updateElement(id, {
            points: [0, 0, p.x - startX, p.y - startY],
            width: Math.abs(p.x - startX),
            height: Math.abs(p.y - startY),
          });
        } else {
          updateElement(id, {
            x: Math.min(p.x, startX),
            y: Math.min(p.y, startY),
            width: Math.abs(p.x - startX),
            height: Math.abs(p.y - startY),
          });
        }
        return;
      }

      case "arrow-pending": {
        // Only create the arrow once the pointer has actually moved
        if (Math.hypot(p.x - g.from.x, p.y - g.from.y) * scale < 4) return;
        const hit = findSnap(p, doc.elements, doc.order, scale);
        const id = addElement({
          type: "arrow",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          stroke: "#111111",
          strokeWidth: 2,
          start: g.start,
          end: makeEnd(hit, p),
        });
        updateSnap(hit);
        gesture.current = {
          kind: "endpoint",
          id,
          which: "end",
          moved: true,
          fromTool: true,
        };
        return;
      }

      case "endpoint": {
        if (!g.moved) {
          useEditor.getState().commit(); // one undo step for the whole adjustment
          g.moved = true;
        }
        const hit = findSnap(
          p,
          useEditor.getState().doc.elements,
          useEditor.getState().doc.order,
          scale,
        );
        const end = makeEnd(hit, p);
        updateElement(g.id, g.which === "start" ? { start: end } : { end });
        updateSnap(hit);
        return;
      }
    }
  };

  // Zoom toward the cursor
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (editingId) return;
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const old = stage.scaleX();
    const ptr = stage.getPointerPosition()!;
    const mouse = {
      x: (ptr.x - stage.x()) / old,
      y: (ptr.y - stage.y()) / old,
    };
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, e.evt.deltaY > 0 ? old / 1.08 : old * 1.08),
    );
    stage.scale({ x: next, y: next });
    stage.position({ x: ptr.x - mouse.x * next, y: ptr.y - mouse.y * next });
    setScale(next);
  };

  /* ------------------------------- render -------------------------------- */

  const editingEl = editingId ? doc.elements[editingId] : undefined;
  const snapEl = snap ? doc.elements[snap.elementId] : undefined;

  // Endpoint handles for a single selected arrow
  const selectedArrow =
    !readOnly && tool === "select" && selectedIds.length === 1
      ? doc.elements[selectedIds[0]]
      : undefined;
  const handles =
    selectedArrow?.type === "arrow" && selectedArrow.start && selectedArrow.end
      ? ([
          { which: "start", pt: resolveEnd(selectedArrow.start, doc.elements) },
          { which: "end", pt: resolveEnd(selectedArrow.end, doc.elements) },
        ] as const)
      : [];

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#f3f4f6",
      }}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
          sharedStageRef.current = node; // used by the thumbnail uploader
        }}
        width={size.width}
        height={size.height}
        // Pan with the hand tool; in the viewer, pan by dragging unless placing a comment
        draggable={tool === "hand" || (readOnly && !commentMode)}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={finishGesture}
        onWheel={onWheel}
      >
        <Layer>
          {doc.order.map((id) => {
            const el = doc.elements[id];
            if (!el) return null;
            return el.type === "arrow" ? (
              <ArrowNode
                key={id}
                el={el}
                elements={doc.elements}
                readOnly={readOnly}
                selected={!readOnly && selectedIds.includes(id)}
              />
            ) : (
              <ElementNode
                key={id}
                el={el}
                readOnly={readOnly}
                hidden={id === editingId}
                onEditText={setEditingId}
              />
            );
          })}
          {!readOnly && (
            <Transformer
              ref={trRef}
              rotateEnabled
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
              }
              onTransformStart={() => useEditor.getState().commit()}
            />
          )}
        </Layer>

        {/* Editing overlays: selection rectangle, attach points, arrow handles */}
        {!readOnly && (
          <Layer>
            {marquee && (
              <Rect
                {...marquee}
                fill="rgba(37,99,235,0.08)"
                stroke="#2563eb"
                strokeWidth={1 / scale}
                listening={false}
              />
            )}
            {snap && snapEl && (
              <SnapAnchors el={snapEl} active={snap.side} scale={scale} />
            )}
            {handles.map(({ which, pt }) => (
              <Circle
                key={which}
                x={pt.x}
                y={pt.y}
                radius={6 / scale}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={2 / scale}
                onMouseEnter={(e) => {
                  e.target.getStage()!.container().style.cursor = "pointer";
                }}
                onMouseLeave={(e) => {
                  e.target.getStage()!.container().style.cursor = "default";
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true; // don't start a marquee underneath
                  gesture.current = {
                    kind: "endpoint",
                    id: selectedArrow!.id,
                    which,
                    moved: false,
                    fromTool: false,
                  };
                }}
              />
            ))}
          </Layer>
        )}

        {readOnly && <CommentPins comments={comments ?? []} scale={scale} />}
      </Stage>

      {editingEl && stageRef.current && (
        <TextEditor
          key={editingEl.id}
          stage={stageRef.current}
          el={editingEl}
          onDone={(value) => finishEditing(editingEl.id, value)}
        />
      )}
    </div>
  );
}
