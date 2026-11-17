import { WireframeCard } from "./WireframeCard";
import type { WireframeSummary } from "./WireframeCard";

interface Props {
  wireframes: WireframeSummary[];
  loading?: boolean;
  editable?: boolean;
  emptyMessage?: string;
  onDelete?: (id: string) => Promise<void> | void;
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4";

export function WireframeGrid({
  wireframes,
  loading = false,
  editable = false,
  emptyMessage = "No wireframes found.",
  onDelete,
}: Props) {
  // First load: skeleton placeholders so the layout doesn't jump
  if (loading && wireframes.length === 0) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-lg border border-gray-200"
          >
            <div className="aspect-[4/3] bg-gray-100" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (wireframes.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <div className={GRID}>
      {wireframes.map((w) => (
        <WireframeCard
          key={w.id}
          wireframe={w}
          editable={editable}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
