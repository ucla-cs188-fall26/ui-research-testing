import { useEffect, useRef, useState } from "react";
import { deleteComment, setResolved } from "../../api/comments";
import type { Comment } from "../../api/comments";
import { useCommentStore } from "../../store/commentStore";
import { CommentInput } from "./CommentInput";

interface Props {
  root: Comment;
  replies: Comment[];
  wireframeId: string;
  pinNumber?: number; // matches the number drawn on the canvas pin
  currentUserId: string | null;
  isOwner: boolean; // is the viewer the wireframe's owner?
  onChanged?: () => void; // optional manual refetch (realtime handles it normally)
}

function Avatar({ comment }: { comment: Comment }) {
  const name = comment.profiles?.username ?? "?";
  if (comment.profiles?.avatar_url) {
    return (
      <img
        src={comment.profiles.avatar_url}
        alt={name}
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
      {name[0]?.toUpperCase()}
    </span>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Avatar comment={comment} />
        <span className="text-sm font-medium">
          {comment.profiles?.username ?? "Unknown"}
        </span>
        <span className="text-xs text-gray-400">
          {formatTime(comment.created_at)}
        </span>
        {canDelete && (
          <button
            onClick={onDelete}
            className="ml-auto text-xs text-gray-400 hover:text-red-600"
          >
            Delete
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap pl-8 text-sm text-gray-800">
        {comment.body}
      </p>
    </div>
  );
}

export function CommentThread({
  root,
  replies,
  wireframeId,
  pinNumber,
  currentUserId,
  isOwner,
  onChanged,
}: Props) {
  const isActive = useCommentStore((s) => s.activeCommentId === root.id);
  const setActive = useCommentStore((s) => s.setActiveComment);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // When a pin on the canvas is clicked, bring its thread into view
  useEffect(() => {
    if (isActive)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isActive]);

  const canResolve = isOwner || currentUserId === root.author_id;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const remove = (c: Comment) => {
    if (!window.confirm("Delete this comment?")) return;
    run(() => deleteComment(c.id));
  };

  return (
    <div
      ref={ref}
      onClick={() => setActive(root.id)}
      className={`flex flex-col gap-3 rounded-md border p-3 ${
        isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
      } ${root.resolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        {pinNumber !== undefined && (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white">
            {pinNumber}
          </span>
        )}
        <div className="flex-1">
          <CommentRow
            comment={root}
            canDelete={currentUserId === root.author_id}
            onDelete={() => remove(root)}
          />
        </div>
      </div>

      {replies.length > 0 && (
        <div className="flex flex-col gap-3 border-l-2 border-gray-100 pl-3">
          {replies.map((r) => (
            <CommentRow
              key={r.id}
              comment={r}
              canDelete={currentUserId === r.author_id}
              onDelete={() => remove(r)}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div
        className="flex items-center gap-3 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setReplying((v) => !v)}
          className="text-blue-600 hover:underline"
        >
          {replying ? "Close" : "Reply"}
        </button>
        {canResolve && (
          <button
            onClick={() => run(() => setResolved(root.id, !root.resolved))}
            className="text-gray-600 hover:underline"
          >
            {root.resolved ? "Reopen" : "Resolve"}
          </button>
        )}
        {root.resolved && <span className="text-green-600">Resolved</span>}
      </div>

      {replying && (
        <div onClick={(e) => e.stopPropagation()}>
          <CommentInput
            wireframeId={wireframeId}
            parentId={root.id}
            placeholder="Write a reply…"
            autoFocus
            onSubmitted={() => {
              setReplying(false);
              onChanged?.();
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}
