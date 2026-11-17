// hooks/useAutosave.ts
import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useEditor } from "../store/editorStore";
import { uploadThumbnail } from "../lib/thumbnail";

export function useAutosave(wireframeId: string) {
  const doc = useEditor((s) => s.doc);
  const isDirty = useEditor((s) => s.isDirty);
  const lastThumb = useRef(0);

  useEffect(() => {
    if (!isDirty) return;

    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("wireframes")
        .update({ document: doc, updated_at: new Date().toISOString() })
        .eq("id", wireframeId);

      if (error) return; // surface this in your "Error" indicator
      useEditor.setState({ isDirty: false });

      // Throttled thumbnail
      if (Date.now() - lastThumb.current > 60_000) {
        lastThumb.current = Date.now();

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user.id;
        if (!userId) return;

        try {
          const url = await uploadThumbnail(doc, wireframeId, userId);
          await supabase
            .from("wireframes")
            .update({ thumbnail_url: url })
            .eq("id", wireframeId);
        } catch (e) {
          console.error("Thumbnail upload failed", e);
        }
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [doc, isDirty, wireframeId]);
}
