import type Konva from "konva";
import { Rect, Ellipse, Text } from "react-konva";
import { useEditor } from "../store/editorStore";
import type { WireframeElement } from "../api/wireframe";

// components/ElementNode.tsx
export default function ElementNode({
  el,
  readOnly,
}: {
  el: WireframeElement;
  readOnly: boolean;
}) {
  const { updateElement, select, tool } = useEditor();

  const common = {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    fill: el.fill,
    stroke: el.stroke,
    strokeWidth: el.strokeWidth,
    draggable: !readOnly && tool === "select",
    onClick: () => !readOnly && select([el.id]),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      updateElement(el.id, { x: e.target.x(), y: e.target.y() }, true),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      // Konva changes scale when resizing; bake it into width/height
      const w = Math.max(5, node.width() * node.scaleX());
      const h = Math.max(5, node.height() * node.scaleY());
      node.scaleX(1);
      node.scaleY(1);
      updateElement(
        el.id,
        {
          x: node.x(),
          y: node.y(),
          width: w,
          height: h,
          rotation: node.rotation(),
        },
        true,
      );
    },
  };

  switch (el.type) {
    case "rect":
    case "frame":
      return <Rect {...common} width={el.width} height={el.height} />;
    case "ellipse":
      return (
        <Ellipse
          {...common}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          offsetX={-el.width / 2}
          offsetY={-el.height / 2}
        />
      );
    case "text":
      return (
        <Text
          {...common}
          text={el.text ?? "Text"}
          fontSize={el.fontSize ?? 16}
          width={el.width}
        />
      );
    default:
      return null;
  }
}
