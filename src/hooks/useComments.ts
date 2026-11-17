import { useState, useEffect } from "react";
import type { Comment } from "../api/comments";
import { supabase } from "../lib/supabase";

async function fetchComments(wireframeId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("wireframe_id", wireframeId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Comment[];
}

export function useComments(wireframeId: string) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadComments = async () => {
      const nextComments = await fetchComments(wireframeId);
      if (isMounted) {
        setComments(nextComments);
      }
    };

    void loadComments();

    const ch = supabase
      .channel("c:" + wireframeId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `wireframe_id=eq.${wireframeId}`,
        },
        () => {
          void loadComments();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(ch);
    };
  }, [wireframeId]);

  return comments;
}
