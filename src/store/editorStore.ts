// store/editorStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  ElementType,
  WireframeDoc,
  WireframeElement,
} from "../api/wireframe";

type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "text"
  | "line"
  | "frame"
  | "arrow"
  | "hand";

interface EditorState {
  doc: WireframeDoc;
  past: WireframeDoc[];
  future: WireframeDoc[];
  selectedIds: string[];
  tool: Tool;
  isDirty: boolean;

  addElement: (
    partial: Partial<WireframeElement> & { type: ElementType },
  ) => string;
  updateElement: (
    id: string,
    patch: Partial<WireframeElement>,
    commit?: boolean,
  ) => void;
  deleteSelected: () => void;
  select: (ids: string[]) => void;
  setTool: (t: Tool) => void;
  commit: () => void; // snapshot for undo
  undo: () => void;
  redo: () => void;
  loadDoc: (doc: WireframeDoc) => void;
}

const emptyDoc: WireframeDoc = { version: 1, elements: {}, order: [] };

export const useEditor = create<EditorState>((set, get) => ({
  doc: emptyDoc,
  past: [],
  future: [],
  selectedIds: [],
  tool: "select",
  isDirty: false,

  commit: () =>
    set((s) => ({ past: [...s.past.slice(-99), s.doc], future: [] })),

  addElement: (partial) => {
    get().commit();
    const id = nanoid();
    const el: WireframeElement = {
      id,
      name: partial.type,
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      rotation: 0,
      fill: "#ffffff",
      stroke: "#222222",
      strokeWidth: 1,
      ...partial,
    };
    set((s) => ({
      doc: {
        ...s.doc,
        elements: { ...s.doc.elements, [id]: el },
        order: [...s.doc.order, id],
      },
      selectedIds: [id],
      isDirty: true,
    }));
    return id;
  },

  updateElement: (id, patch, commit = false) => {
    if (commit) get().commit();
    set((s) => ({
      doc: {
        ...s.doc,
        elements: {
          ...s.doc.elements,
          [id]: { ...s.doc.elements[id], ...patch },
        },
      },
      isDirty: true,
    }));
  },

  deleteSelected: () => {
    get().commit();
    set((s) => {
      const ids = new Set(s.selectedIds);
      const elements = { ...s.doc.elements };
      ids.forEach((id) => delete elements[id]);
      return {
        doc: {
          ...s.doc,
          elements,
          order: s.doc.order.filter((i) => !ids.has(i)),
        },
        selectedIds: [],
        isDirty: true,
      };
    });
  },

  select: (ids) => set({ selectedIds: ids }),
  setTool: (tool) => set({ tool }),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future],
        isDirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        doc: next,
        past: [...s.past, s.doc],
        future: s.future.slice(1),
        isDirty: true,
      };
    }),

  loadDoc: (doc) =>
    set({ doc, past: [], future: [], selectedIds: [], isDirty: false }),
}));
