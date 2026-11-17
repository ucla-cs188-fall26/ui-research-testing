import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type Konva from "konva";
import type { WireframeElement } from "../api/wireframe";

interface Props {
  stage: Konva.Stage;
  el: WireframeElement;
  onDone: (text: string) => void;
}

function autoGrow(ta: HTMLTextAreaElement) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

// An HTML textarea laid over the Konva text node while it is being edited.
// Escape, Ctrl/Cmd+Enter, or clicking away commits.
export function TextEditor({ stage, el, onDone }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  // Position the textarea exactly over the node, matching zoom, pan and rotation
  useLayoutEffect(() => {
    const node = stage.findOne("#" + el.id);
    if (!node) return;

    const pos = node.getAbsolutePosition();
    const scale = node.getAbsoluteScale().x;
    const fontSize = (el.fontSize ?? 24) * scale;

    setStyle({
      position: "absolute",
      left: pos.x,
      top: pos.y,
      width: el.width * scale,
      minHeight: fontSize,
      margin: 0,
      padding: 0,
      border: "none",
      outline: "1px solid #2563eb",
      background: "rgba(255,255,255,0.9)",
      resize: "none",
      overflow: "hidden",
      fontFamily: "Arial, sans-serif",
      fontSize,
      lineHeight: 1,
      color: el.fill ?? "#111111",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      transform: `rotate(${node.getAbsoluteRotation()}deg)`,
      transformOrigin: "top left",
      zIndex: 10,
    });
  }, [stage, el.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus after the click that created/opened the editor has finished,
  // otherwise the browser's default focus handling steals it back.
  useEffect(() => {
    if (!style) return;
    const ta = taRef.current;
    if (!ta) return;
    const t = setTimeout(() => {
      ta.focus();
      ta.select();
      autoGrow(ta);
    }, 0);
    return () => clearTimeout(t);
  }, [style]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone(taRef.current?.value ?? "");
  };

  if (!style) return null;

  return (
    <textarea
      ref={taRef}
      defaultValue={el.text ?? ""}
      rows={1}
      style={style}
      onInput={(e) => autoGrow(e.currentTarget)}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (
          e.key === "Escape" ||
          (e.key === "Enter" && (e.metaKey || e.ctrlKey))
        ) {
          e.preventDefault();
          finish();
        }
      }}
    />
  );
}
