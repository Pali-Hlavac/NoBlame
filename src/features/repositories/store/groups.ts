/** UI state of the repository groups: which group's name is being edited. */
import { create } from "zustand";

interface GroupsUiState {
  /** Group whose name shows as a text field (a new group starts so). */
  editingId: string | null;
  setEditing: (id: string | null) => void;
}

export const useGroupsUiStore = create<GroupsUiState>()((set) => ({
  editingId: null,
  setEditing: (editingId) => {
    set({ editingId });
  },
}));
