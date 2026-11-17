import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Canvas } from "../components/Canvas";
import CommentSidebar from "../components/feedback/CommentSidebar";
import { useEditor } from "../store/editorStore";
import { getWireframe } from "../api/wireframe";
import { useComments } from "../hooks/useComments";
import { useSession } from "../hooks/useSession";

type WireframeRow = {
  id?: string;
  owner_id?: string | null;
  document?: unknown;
  title?: string;
  thumbnail_url?: string;
  updated_at?: string;
};

export default function Viewer() {
  const { id } = useParams();
  const { session } = useSession();
  const loadDoc = useEditor((s) => s.loadDoc);
  const [meta, setMeta] = useState<WireframeRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const currentUserId = session?.user.id ?? null;

  const comments = useComments(id ?? "");

  useEffect(() => {
    if (!id) return;

    getWireframe(id).then((row) => {
      setMeta(row);
      if (row?.document) loadDoc(row.document as any);
    });
  }, [id, loadDoc]);

  const isOwner =
    !!meta?.owner_id && !!currentUserId && meta.owner_id === currentUserId;

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Canvas readOnly comments={comments} />
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex justify-end">
        <div className="pointer-events-auto h-full w-[min(30rem,80vw)] max-w-md">
          <CommentSidebar
            wireframeId={id ?? ""}
            comments={comments}
            currentUserId={currentUserId}
            isOwner={isOwner}
            open={panelOpen}
            onToggle={() => setPanelOpen((value) => !value)}
          />
        </div>
      </div>
    </div>
  );
}
