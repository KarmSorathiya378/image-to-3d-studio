import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LightingPreset, ModelAsset, Project, ViewerSettings } from "@/types";

interface StudioState {
  projects: Project[];
  activeProjectId: string;
  models: ModelAsset[];
  activeModelId: string | null;
  viewerSettings: ViewerSettings;
  sidebarCollapsed: boolean;
  inspectorTab: "info" | "geometry" | "materials" | "config" | "export";
  activeModal: "new-generation" | null;
  saveStatus: "saved" | "saving" | "unsaved";

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setInspectorTab: (tab: "info" | "geometry" | "materials" | "config" | "export") => void;
  setActiveModal: (modal: "new-generation" | null) => void;
  selectProject: (id: string) => void;
  selectModel: (id: string) => void;
  updateProjectName: (id: string, name: string) => void;
  updateModelMaterial: (materialId: string, updates: { baseColor?: string; roughness?: number; metallic?: number }) => void;

  // Viewer toggles
  toggleWireframe: () => void;
  toggleGrid: () => void;
  toggleAutoRotate: () => void;
  setLightingPreset: (preset: LightingPreset) => void;

  // Export action
  exportModel: (format: "glb" | "obj" | "stl") => void;
  addModel: (model: ModelAsset) => void;
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: "proj_woodworking",
    name: "Scandinavian Stool Collection",
    description: "Single-photo procedural 3D reconstruction of classic Nordic furniture",
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000 * 2,
    modelsCount: 2,
    activeModelId: "mod_classic_stool",
  },
  {
    id: "proj_lighting",
    name: "Architectural Table Lamps",
    description: "VLM geometric planning from museum archive photos",
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 1,
    modelsCount: 1,
    activeModelId: "mod_brass_lamp",
  },
];

const INITIAL_MODELS: ModelAsset[] = [
  {
    id: "mod_classic_stool",
    projectId: "proj_woodworking",
    name: "Round Birch Stool (v1)",
    description: "Constructed from 4 tapered legs, circular seat, and structural bracing ring",
    format: "glb",
    status: "ready",
    triangles: 1420,
    vertices: 864,
    dimensions: { width: 1.5, height: 1.52, depth: 1.5 },
    sizeBytes: 184520,
    version: 1,
    createdAt: Date.now() - 3600000 * 4,
    sceneSpec: {
      schemaVersion: "1.0",
      objectName: "scandinavian_stool",
      coordinateSystem: "Z_UP",
      units: "relative",
      referenceView: { azimuthDeg: 35, elevationDeg: 15 },
      parts: [
        { id: "seat", name: "Round Seat", type: "cylinder", size: [1.5, 1.5, 0.14], position: [0, 0, 1.45], rotationDeg: [0, 0, 0], materialId: "birch_wood" },
        { id: "leg_1", name: "Front Left Leg", type: "cylinder", size: [0.09, 0.09, 1.4], position: [-0.48, -0.48, 0.7], rotationDeg: [5, -5, 0], materialId: "dark_wood" },
        { id: "leg_2", name: "Front Right Leg", type: "cylinder", size: [0.09, 0.09, 1.4], position: [0.48, -0.48, 0.7], rotationDeg: [5, 5, 0], materialId: "dark_wood" },
        { id: "leg_3", name: "Rear Left Leg", type: "cylinder", size: [0.09, 0.09, 1.4], position: [-0.48, 0.48, 0.7], rotationDeg: [-5, -5, 0], materialId: "dark_wood" },
        { id: "leg_4", name: "Rear Right Leg", type: "cylinder", size: [0.09, 0.09, 1.4], position: [0.48, 0.48, 0.7], rotationDeg: [-5, 5, 0], materialId: "dark_wood" },
        { id: "brace_ring", name: "Cross Brace", type: "torus", size: [0.84, 0.84, 0.04], position: [0, 0, 0.6], rotationDeg: [0, 0, 0], materialId: "dark_wood" },
      ],
      materials: [
        { id: "birch_wood", name: "Natural Birch", baseColor: "#a16207", roughness: 0.55, metallic: 0.05 },
        { id: "dark_wood", name: "Stained Walnut", baseColor: "#78350f", roughness: 0.7, metallic: 0.0 },
      ],
      uncertaintyNotes: ["Rear leg positions approximated from single oblique camera perspective."],
    },
  },
  {
    id: "mod_brass_lamp",
    projectId: "proj_lighting",
    name: "Minimalist Brass Desk Lamp",
    description: "Cylindrical heavy base with angled stem and conical shade",
    format: "glb",
    status: "ready",
    triangles: 2180,
    vertices: 1240,
    dimensions: { width: 0.8, height: 1.8, depth: 1.1 },
    sizeBytes: 245000,
    version: 1,
    createdAt: Date.now() - 86400000,
    sceneSpec: {
      schemaVersion: "1.0",
      objectName: "brass_desk_lamp",
      coordinateSystem: "Z_UP",
      units: "relative",
      referenceView: { azimuthDeg: 45, elevationDeg: 20 },
      parts: [
        { id: "base", name: "Weighted Base", type: "cylinder", size: [0.8, 0.8, 0.1], position: [0, 0, 0.05], rotationDeg: [0, 0, 0], materialId: "brushed_brass" },
        { id: "vertical_stem", name: "Vertical Stem", type: "cylinder", size: [0.05, 0.05, 1.3], position: [0, 0, 0.7], rotationDeg: [0, 0, 0], materialId: "brushed_brass" },
        { id: "shade", name: "Conical Shade", type: "cone", size: [0.6, 0.6, 0.45], position: [0.2, 0, 1.4], rotationDeg: [0, 25, 0], materialId: "matte_white" },
      ],
      materials: [
        { id: "brushed_brass", name: "Brushed Brass", baseColor: "#d97706", roughness: 0.35, metallic: 0.85 },
        { id: "matte_white", name: "Matte Enamel", baseColor: "#f8fafc", roughness: 0.8, metallic: 0.05 },
      ],
    },
  },
];

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      projects: INITIAL_PROJECTS,
      activeProjectId: "proj_woodworking",
      models: INITIAL_MODELS,
      activeModelId: "mod_classic_stool",
      sidebarCollapsed: false,
      inspectorTab: "info",
      activeModal: null,
      saveStatus: "saved",
      viewerSettings: {
        wireframe: false,
        showGrid: true,
        autoRotate: false,
        autoRotateSpeed: 1.0,
        lightingPreset: "studio",
        exposure: 1.0,
        cameraFov: 45,
        backgroundColor: "#0b0f19",
      },

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),
      setActiveModal: (modal) => set({ activeModal: modal }),

      selectProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        const activeModel = get().models.find((m) => m.projectId === id) || null;
        set({
          activeProjectId: id,
          activeModelId: activeModel ? activeModel.id : null,
        });
      },

      selectModel: (id) => set({ activeModelId: id }),

      updateProjectName: (id, name) => {
        set({ saveStatus: "saving" });
        setTimeout(() => {
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
            saveStatus: "saved",
          }));
        }, 300);
      },

      updateModelMaterial: (materialId, updates) => {
        const activeId = get().activeModelId;
        if (!activeId) return;

        set((state) => ({
          models: state.models.map((m) => {
            if (m.id !== activeId || !m.sceneSpec) return m;
            return {
              ...m,
              sceneSpec: {
                ...m.sceneSpec,
                materials: m.sceneSpec.materials.map((mat) =>
                  mat.id === materialId ? { ...mat, ...updates } : mat
                ),
              },
            };
          }),
        }));
      },

      toggleWireframe: () =>
        set((s) => ({
          viewerSettings: { ...s.viewerSettings, wireframe: !s.viewerSettings.wireframe },
        })),

      toggleGrid: () =>
        set((s) => ({
          viewerSettings: { ...s.viewerSettings, showGrid: !s.viewerSettings.showGrid },
        })),

      toggleAutoRotate: () =>
        set((s) => ({
          viewerSettings: { ...s.viewerSettings, autoRotate: !s.viewerSettings.autoRotate },
        })),

      setLightingPreset: (preset) =>
        set((s) => ({
          viewerSettings: { ...s.viewerSettings, lightingPreset: preset },
        })),

      exportModel: (format) => {
        const activeModel = get().models.find((m) => m.id === get().activeModelId);
        const name = activeModel ? activeModel.name.toLowerCase().replace(/\s+/g, "_") : "model_export";
        const filename = `${name}.${format}`;

        // Create a real downloadable dummy glb/obj/stl file
        const blob = new Blob(
          [
            format === "obj"
              ? `# Image-to-3D Studio Export\no ${name}\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`
              : format === "stl"
              ? `solid ${name}\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid ${name}\n`
              : `glTF-binary-header-simulated-for-${name}`
          ],
          { type: "application/octet-stream" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      addModel: (model) => {
        set((state) => ({
          models: [model, ...state.models],
          activeModelId: model.id,
          projects: state.projects.map((p) =>
            p.id === model.projectId
              ? { ...p, modelsCount: p.modelsCount + 1, updatedAt: Date.now() }
              : p
          ),
        }));
      },
    }),
    {
      name: "image-to-3d-studio",
    }
  )
);
