import { useState } from "react";
import { Link } from "react-router-dom";

export interface WireframeSummary {
  id: string;
  title: string;
  thumbnail_url: string | null;
  updated_at: string;
  is_public?: boolean;
  profiles?: { username: string; avatar_url: string | null } | null;
  // Present on the "Mine" tab: [{ count: n }] of unresolved top-level comments
  comments?: { count: number }[];
}

interface Props {
  wireframe: WireframeSummary;
  editable?: boolean; // true on the "Mine" tab: shows Edit link, status and feedback count
  onDelete?: (id: string) => Promise<void> | void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { dateStyle: "medium" });
}

export function WireframeCard({
  wireframe,
  editable = false,
  onDelete,
}: Props) {
  const {
    id,
    title,
    thumbnail_url,
    updated_at,
    is_public,
    profiles,
    comments,
  } = wireframe;
  const unresolved = comments?.[0]?.count ?? 0;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete) return;

    const confirmed = window.confirm(
      `Delete "${title || "Untitled"}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={`/w/${id}`} className="relative block aspect-[4/3] bg-gray-100">
        {thumbnail_url ? (
          <img
            src={thumbnail_url}
            alt={`Preview of ${title}`}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No preview yet
          </div>
        )}
        {editable && unresolved > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
            {unresolved} open
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-1 p-3">
        <Link
          to={`/w/${id}`}
          className="truncate font-medium text-gray-900 hover:underline"
        >
          {title || "Untitled"}
        </Link>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          {!editable && profiles && (
            <>
              {profiles.avatar_url ? (
                <img
                  src={profiles.avatar_url}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-700">
                  {profiles.username[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate">{profiles.username}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{formatDate(updated_at)}</span>
        </div>

        {editable && (
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 ${
                is_public
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {is_public ? "Public" : "Private"}
            </span>

            <div className="flex items-center gap-2">
              <Link
                to={`/editor/${id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
