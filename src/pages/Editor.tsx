import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { deleteWireframe } from "../api/wireframe";
import { useEditor } from "../store/editorStore";
import { useAutosave } from "../hooks/useAutosave";
import { Canvas } from "../components/Canvas";
import { Toolbar } from "../components/Toolbar";

const EMPTY_DOC = { version: 1 as const, elements: {}, order: [] as string[] };

type Meta = { title: string; is_public: boolean };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; meta: Meta };

/* -------------------------------------------------------------------------- */
/*  EditorBody only mounts after the document has been loaded into the store, */
/*  so autosave can never write a stale document from a previous wireframe.   */
/* -------------------------------------------------------------------------- */

function EditorBody({ id, initial }: { id: string; initial: Meta }) {
  useAutosave(id);

  const isDirty = useEditor((s) => s.isDirty);
  const [title, setTitle] = useState(initial.title);
  const [isPublic, setIsPublic] = useState(initial.is_public);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const savedTitle = useRef(initial.title);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // If the user navigates away before the autosave debounce fires, save now
  useEffect(() => {
    return () => {
      const { doc, isDirty } = useEditor.getState();
      if (!isDirty) return;
      supabase
        .from("wireframes")
        .update({ document: doc, updated_at: new Date().toISOString() })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) useEditor.setState({ isDirty: false });
        });
    };
  }, [id]);

  const saveTitle = async () => {
    const next = title.trim() || "Untitled";
    setTitle(next);
    if (next === savedTitle.current) return;
    const { error } = await supabase
      .from("wireframes")
      .update({ title: next })
      .eq("id", id);
    if (error) setError(error.message);
    else savedTitle.current = next;
  };

  const togglePublic = async (next: boolean) => {
    setIsPublic(next);
    setError(null);
    const { error } = await supabase
      .from("wireframes")
      .update({ is_public: next })
      .eq("id", id);
    if (error) {
      setIsPublic(!next);
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Delete this wireframe? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteWireframe(id);
      window.location.assign("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete wireframe.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={100}
          aria-label="Wireframe title"
          className="min-w-0 max-w-xs flex-1 rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-gray-300 focus:border-blue-500 focus:outline-none"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => togglePublic(e.target.checked)}
          />
          Public
        </label>

        {error && <span className="text-xs text-red-600">{error}</span>}

        <span className="ml-auto text-xs text-gray-500">
          {isDirty ? "Unsaved changes…" : "All changes saved"}
        </span>
        <Link to={`/w/${id}`} className="text-sm text-blue-600 hover:underline">
          View
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      <Toolbar />

      <div className="min-h-0 flex-1">
        <Canvas />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor page: loads the wireframe, then renders the editor                 */
/* -------------------------------------------------------------------------- */

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadDoc = useEditor((s) => s.loadDoc);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      const [
        {
          data: { session },
        },
        { data: row, error },
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from("wireframes")
          .select("title, is_public, owner_id, document")
          .eq("id", id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      if (!row) {
        setState({
          status: "error",
          message: "Wireframe not found, or you don't have access to it.",
        });
        return;
      }
      // Only the owner can edit; everyone else gets the read-only viewer
      if (row.owner_id !== session?.user.id) {
        navigate(`/w/${id}`, { replace: true });
        return;
      }

      const d = row.document;
      loadDoc(d && d.elements && Array.isArray(d.order) ? d : EMPTY_DOC);
      setState({
        status: "ready",
        meta: { title: row.title, is_public: row.is_public },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, loadDoc, navigate]);

  if (!id)
    return <p className="p-6 text-sm text-red-600">Missing wireframe id.</p>;

  if (state.status === "loading") {
    return <p className="p-6 text-sm text-gray-500">Loading wireframe…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="p-6 text-sm">
        <p className="mb-2 text-red-600">{state.message}</p>
        <Link to="/dashboard" className="text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // key={id} remounts the editor if you switch wireframes without leaving the route
  return <EditorBody key={id} id={id} initial={state.meta} />;
}
