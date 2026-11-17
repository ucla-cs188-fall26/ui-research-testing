import { supabase } from "../lib/supabase";

// types/wireframe.ts
export type ElementType =
  | "rect"
  | "ellipse"
  | "text"
  | "line"
  | "frame"
  | "arrow";
export type Side = "top" | "right" | "bottom" | "left";
export interface ArrowEnd {
  x: number;
  y: number;
  elementId?: string;
  side?: Side;
}

export interface WireframeElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string; // for text elements
  fontSize?: number;
  points?: number[]; // for lines
  start?: ArrowEnd; // for arrows
  end?: ArrowEnd; // for arrows
}

export interface WireframeDoc {
  version: 1; // lets you migrate the schema later
  elements: Record<string, WireframeElement>;
  order: string[]; // z-order, bottom to top
}

export async function listPublicWireframes(page = 0, search = "") {
  let q = supabase
    .from("wireframes")
    .select(
      "id, title, thumbnail_url, updated_at, profiles(username, avatar_url)",
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .range(page * 24, page * 24 + 23);
  if (search) q = q.ilike("title", `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getWireframe(id: string) {
  const { data, error } = await supabase
    .from("wireframes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function listMyWireframes(page = 0, search = "") {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to see your wireframes.");

  let q = supabase
    .from("wireframes")
    .select("id, title, thumbnail_url, updated_at, is_public, comments(count)")
    .eq("owner_id", session.user.id)
    .eq("comments.resolved", false) // filters the embedded count, not the parent rows
    .is("comments.parent_id", null)
    .order("updated_at", { ascending: false })
    .range(page * 24, page * 24 + 23);
  if (search) q = q.ilike("title", `%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteWireframe(id: string) {
  const { error } = await supabase.from("wireframes").delete().eq("id", id);
  if (error) throw error;
}
