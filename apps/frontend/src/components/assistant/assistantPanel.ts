import { create } from 'zustand';

interface AssistantPanelState {
  isOpen: boolean;
  /** Proyecto sugerido al abrir desde un tablero, para no preguntar lo obvio. */
  presetProjectId: string | null;
  open: (presetProjectId?: string) => void;
  close: () => void;
}

export const useAssistantPanel = create<AssistantPanelState>((set) => ({
  isOpen: false,
  presetProjectId: null,
  open: (presetProjectId) => set({ isOpen: true, presetProjectId: presetProjectId ?? null }),
  close: () => set({ isOpen: false }),
}));
