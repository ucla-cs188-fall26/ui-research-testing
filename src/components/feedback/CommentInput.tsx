import { useState, type FormEvent, type KeyboardEvent } from "react";
import { addComment } from "../../api/comments";

interface Props {
  wireframeId: string;
  parentId?: string | null; // set when replying to a thread
  pin?: { x: number; y: number } | null; // set when attaching to a canvas position
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

export function CommentInput({
  wireframeId,
  parentId = null,
  pin = null,
  placeholder = "Add a comment…",
  autoFocus = false,
  onSubmitted,
  onCancel,
}: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);
    try {
      await addComment({
        wireframe_id: wireframeId,
        body: text,
        parent_id: parentId,
        x: pin?.x ?? null,
        y: pin?.y ?? null,
      });
      setBody("");
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not post your comment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    if (e.key === "Escape") onCancel?.();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        maxLength={2000}
        className="w-full resize-none rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400">Ctrl/Cmd + Enter to post</p>
    </form>
  );
}
