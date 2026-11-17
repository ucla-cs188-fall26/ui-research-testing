import { supabase } from "../lib/supabase";

export interface Comment {
  id: string;
  wireframe_id: string;
  author_id: string;
  body: string;
  x: number | null;
  y: number | null;
  element_id: string | null;
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
}

export interface NewComment {
  wireframe_id: string;
  body: string;
  x?: number | null;
  y?: number | null;
  element_id?: string | null;
  parent_id?: string | null;
}

export async function listComments(wireframeId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(username, avatar_url)")
    .eq("wireframe_id", wireframeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(input: NewComment): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You need to be signed in to comment.");

  const { error } = await supabase.from("comments").insert({
    wireframe_id: input.wireframe_id,
    author_id: session.user.id, // must match auth.uid() for the RLS policy
    body: input.body,
    x: input.x ?? null,
    y: input.y ?? null,
    element_id: input.element_id ?? null,
    parent_id: input.parent_id ?? null,
  });
  if (error) throw error;
}

export async function setResolved(
  id: string,
  resolved: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .update({ resolved })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}
