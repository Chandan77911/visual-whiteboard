import { create } from 'zustand';

const useWhiteboardStore = create((set, get) => ({
  // Room
  roomId: null,
  user: null,
  roomUsers: [],

  // Tool
  activeTool: 'select', // select | pen | rect | circle | arrow | text | eraser
  strokeColor: '#6c63ff',
  fillColor: 'transparent',
  strokeWidth: 2,
  fontSize: 16,

  // Canvas
  fabricCanvas: null,
  selectedObject: null,
  zoom: 1,

  // Context Layer
  contextPanelOpen: false,
  contextTarget: null, // { objectId, context: { notes, links, snippets, files } }

  // Architecture Assist
  assistPanelOpen: false,
  assistSuggestions: null,
  assistLoading: false,

  // Cleanup
  cleanupInProgress: false,

  // Actions
  setRoomId: (roomId) => set({ roomId }),
  setUser: (user) => set({ user }),
  setRoomUsers: (roomUsers) => set({ roomUsers }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFabricCanvas: (fabricCanvas) => set({ fabricCanvas }),
  setSelectedObject: (selectedObject) => set({ selectedObject }),
  setZoom: (zoom) => set({ zoom }),

  openContextPanel: (objectId, context) =>
    set({ contextPanelOpen: true, contextTarget: { objectId, context } }),
  closeContextPanel: () => set({ contextPanelOpen: false, contextTarget: null }),
  updateContextTarget: (updates) =>
    set((state) => ({
      contextTarget: state.contextTarget
        ? { ...state.contextTarget, context: { ...state.contextTarget.context, ...updates } }
        : null,
    })),

  openAssistPanel: () => set({ assistPanelOpen: true }),
  closeAssistPanel: () => set({ assistPanelOpen: false }),
  setAssistSuggestions: (assistSuggestions) => set({ assistSuggestions }),
  setAssistLoading: (assistLoading) => set({ assistLoading }),

  setCleanupInProgress: (cleanupInProgress) => set({ cleanupInProgress }),
}));

export default useWhiteboardStore;
