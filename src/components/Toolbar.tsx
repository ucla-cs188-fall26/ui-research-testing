import { useEditor } from "../store/editorStore";

const TOOLS = [
  { id: "select", label: "Select" },
  { id: "rect", label: "Rectangle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "text", label: "Text" },
  { id: "line", label: "Line" },
  { id: "frame", label: "Frame" },
  { id: "arrow", label: "Arrow" },
  { id: "hand", label: "Hand" },
] as const;

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const btn =
    "rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white p-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`rounded px-3 py-1 text-sm ${
            tool === t.id ? "bg-blue-600 text-white" : "hover:bg-gray-100"
          }`}
        >
          {t.label}
        </button>
      ))}

      <span className="mx-2 h-5 w-px bg-gray-200" />

      <button onClick={undo} disabled={!canUndo} className={btn}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo} className={btn}>
        Redo
      </button>
    </div>
  );
}
