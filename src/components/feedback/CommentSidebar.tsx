import { useNavigate } from "react-router-dom";
import { useCommentStore } from "../../store/commentStore";
import type { Comment } from "../../api/comments";
import { CommentInput } from "./CommentInput";
import { CommentThread } from "./CommentThread";

type CommentSidebarProps = {
  wireframeId: string;
  comments: Comment[];
  currentUserId: string | null;
  isOwner: boolean;
  open: boolean;
  onToggle: () => void;
};

export default function CommentSidebar({
  wireframeId,
  comments,
  currentUserId,
  isOwner,
  open,
  onToggle,
}: CommentSidebarProps) {
  const navigate = useNavigate();
  const commentMode = useCommentStore((s) => s.commentMode);
  const draftPin = useCommentStore((s) => s.draftPin);
  const setCommentMode = useCommentStore((s) => s.setCommentMode);
  const setDraftPin = useCommentStore((s) => s.setDraftPin);
  const activeCommentId = useCommentStore((s) => s.activeCommentId);

  const roots = comments.filter(
    (comment) =>
      comment.parent_id === null && comment.wireframe_id === wireframeId,
  );

  const repliesByParent = comments.reduce<Record<string, Comment[]>>(
    (acc, comment) => {
      if (!comment.parent_id) return acc;
      acc[comment.parent_id] = [...(acc[comment.parent_id] ?? []), comment];
      return acc;
    },
    {},
  );

  const pinnedRoots = roots.filter(
    (comment) => comment.x !== null && comment.y !== null,
  );
  const unpinnedRoots = roots.filter(
    (comment) => comment.x === null || comment.y === null,
  );

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-4 z-30 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
        >
          Comments
        </button>
      )}

      <aside
        className={`flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white p-4 shadow-lg transition-transform duration-200 ${
          open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        } ${!open ? "pointer-events-none" : "pointer-events-auto"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
            <p className="text-xs text-gray-500">
              {comments.length} total thread{comments.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Hide
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentUserId) {
                  navigate("/login");
                  return;
                }
                setCommentMode(!commentMode);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {currentUserId
                ? commentMode
                  ? "Cancel"
                  : "Comment"
                : "Sign in to comment"}
            </button>
          </div>
        </div>

        {commentMode && (
          <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Click anywhere on the canvas to place a pin, then post your comment.
          </p>
        )}

        {draftPin && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-blue-700">
              <span>Draft pin</span>
              <button
                type="button"
                onClick={() => setDraftPin(null)}
                className="hover:underline"
              >
                Clear
              </button>
            </div>
            <CommentInput
              wireframeId={wireframeId}
              pin={draftPin}
              placeholder="Add a comment at this location…"
              onSubmitted={() => {
                setDraftPin(null);
                setCommentMode(false);
              }}
              onCancel={() => setDraftPin(null)}
            />
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {comments.length === 0 && !draftPin && (
            <p className="rounded border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              No comments yet. Be the first to leave feedback.
            </p>
          )}

          {pinnedRoots.map((root, index) => (
            <CommentThread
              key={root.id}
              root={root}
              replies={repliesByParent[root.id] ?? []}
              wireframeId={wireframeId}
              pinNumber={index + 1}
              currentUserId={currentUserId}
              isOwner={isOwner}
              onChanged={() => {}}
            />
          ))}

          {unpinnedRoots.map((root) => (
            <CommentThread
              key={root.id}
              root={root}
              replies={repliesByParent[root.id] ?? []}
              wireframeId={wireframeId}
              currentUserId={currentUserId}
              isOwner={isOwner}
              onChanged={() => {}}
            />
          ))}

          {!activeCommentId && !draftPin && comments.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Select a pin or click “Comment” to leave a new note on the design.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
