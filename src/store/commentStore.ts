import { create } from "zustand";

export interface DraftPin {
  x: number; // document coordinates, not screen coordinates
  y: number;
}

// UI state only. Server data (the comments themselves) lives in useComments.
interface CommentUIState {
  commentMode: boolean;
  activeCommentId: string | null;
  draftPin: DraftPin | null;

  setCommentMode: (on: boolean) => void;
  setActiveComment: (id: string | null) => void;
  setDraftPin: (pin: DraftPin | null) => void;
  reset: () => void;
}

export const useCommentStore = create<CommentUIState>((set) => ({
  commentMode: false,
  activeCommentId: null,
  draftPin: null,

  // Leaving comment mode also discards an unsent pin
  setCommentMode: (commentMode) =>
    set(commentMode ? { commentMode } : { commentMode, draftPin: null }),

  // Selecting an existing thread and placing a new pin are mutually exclusive
  setActiveComment: (activeCommentId) =>
    set({ activeCommentId, draftPin: null }),
  setDraftPin: (draftPin) => set({ draftPin, activeCommentId: null }),

  // Call on Viewer unmount so state doesn't leak between wireframes
  reset: () =>
    set({ commentMode: false, activeCommentId: null, draftPin: null }),
}));
