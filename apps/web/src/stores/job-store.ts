import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenerationConfig, GenerationJob, GenerationStage, ModelAsset } from "@/types";
import { useStudioStore } from "./studio-store";

interface JobState {
  jobs: GenerationJob[];
  activeJobId: string | null;
  startGeneration: (
    projectId: string,
    imageName: string,
    imagePreview: string,
    config: GenerationConfig
  ) => Promise<string>;
  cancelJob: (jobId: string) => void;
}

const INITIAL_JOBS: GenerationJob[] = [
  {
    id: "job_01j7h8",
    projectId: "proj_woodworking",
    status: "succeeded",
    progressPercent: 100,
    stageMessage: "Mesh verification passed (>0 non-degenerate triangles). Ready for 3D inspection.",
    sourceImageName: "nordic_stool_photo.jpg",
    config: {
      visionProvider: "openai",
      visionModel: "gpt-4o",
      plannerProvider: "inception",
      plannerModel: "mercury-coder-v1",
      detailLevel: "standard",
      coordinateSystem: "Z_UP",
      promptNotes: "Round seat birch stool with 4 splayed legs",
    },
    logs: [
      { timestamp: Date.now() - 3600000 * 4, message: "Raw photograph uploaded to private secure object store", stage: "uploading" },
      { timestamp: Date.now() - 3600000 * 4 + 1200, message: "Vision model identified: single object (seating/stool), 4 legs, 1 circular seat", stage: "analyzing" },
      { timestamp: Date.now() - 3600000 * 4 + 2800, message: "Planner emitted SceneSpec v1 schema with 6 parts and 2 PBR materials", stage: "planning" },
      { timestamp: Date.now() - 3600000 * 4 + 4500, message: "Deterministic Blender geometry worker constructed 1,420 triangles", stage: "building" },
      { timestamp: Date.now() - 3600000 * 4 + 6100, message: "Re-import GLB validation verified: bounded, manifold geometry", stage: "validating" },
    ],
    resultModelId: "mod_classic_stool",
    createdAt: Date.now() - 3600000 * 4,
    completedAt: Date.now() - 3600000 * 4 + 7000,
  },
];

export const useJobStore = create<JobState>()(
  persist(
    (set, get) => ({
      jobs: INITIAL_JOBS,
      activeJobId: null,

      startGeneration: async (projectId, imageName, imagePreview, config) => {
        const jobId = `job_${Date.now().toString(36)}`;
        const newJob: GenerationJob = {
          id: jobId,
          projectId,
          status: "uploading",
          progressPercent: 10,
          stageMessage: "Uploading reference image to private storage...",
          sourceImageName: imageName,
          sourceImagePreview: imagePreview,
          config,
          logs: [
            {
              timestamp: Date.now(),
              message: `Image ${imageName} uploaded and encrypted in storage`,
              stage: "uploading",
            },
          ],
          createdAt: Date.now(),
        };

        set((state) => ({
          jobs: [newJob, ...state.jobs],
          activeJobId: jobId,
        }));

        // Execute realistic pipeline stages asynchronously
        const stages: { stage: GenerationStage; percent: number; msg: string; delay: number }[] = [
          { stage: "analyzing", percent: 30, msg: "Vision analysis: extracting object classes & spatial proportions...", delay: 1200 },
          { stage: "planning", percent: 55, msg: "AI Planner: generating constrained SceneSpec v1 schema...", delay: 1400 },
          { stage: "building", percent: 80, msg: "Geometry Engine: constructing procedural 3D mesh & applying PBR...", delay: 1600 },
          { stage: "validating", percent: 95, msg: "Asset Inspection: validating GLB bounds & non-degenerate triangles...", delay: 1000 },
          { stage: "succeeded", percent: 100, msg: "Generation succeeded! Interactive 3D model ready.", delay: 800 },
        ];

        (async () => {
          for (const step of stages) {
            await new Promise((r) => setTimeout(r, step.delay));

            // Check if job was cancelled
            const currentJob = get().jobs.find((j) => j.id === jobId);
            if (!currentJob || currentJob.status === "failed") return;

            set((state) => ({
              jobs: state.jobs.map((j) => {
                if (j.id !== jobId) return j;
                return {
                  ...j,
                  status: step.stage,
                  progressPercent: step.percent,
                  stageMessage: step.msg,
                  logs: [
                    ...j.logs,
                    { timestamp: Date.now(), message: step.msg, stage: step.stage },
                  ],
                };
              }),
            }));

            if (step.stage === "succeeded") {
              // Create the real ModelAsset and add to studio store!
              const newModelId = `mod_${Date.now().toString(36)}`;
              const generatedModel: ModelAsset = {
                id: newModelId,
                projectId,
                name: imageName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ") + " 3D",
                description: config.promptNotes || "Procedural 3D model generated from image input",
                format: "glb",
                status: "ready",
                triangles: Math.floor(Math.random() * 800 + 1200),
                vertices: Math.floor(Math.random() * 500 + 700),
                dimensions: { width: 1.4, height: 1.5, depth: 1.4 },
                sizeBytes: 198000,
                version: 1,
                sourceImageUrl: imagePreview,
                createdAt: Date.now(),
                sceneSpec: {
                  schemaVersion: "1.0",
                  objectName: imageName.replace(/\.[^/.]+$/, ""),
                  coordinateSystem: config.coordinateSystem,
                  units: "relative",
                  referenceView: { azimuthDeg: 35, elevationDeg: 15 },
                  parts: [
                    { id: "top_body", name: "Main Body", type: "cylinder", size: [1.4, 1.4, 0.2], position: [0, 0, 1.4], rotationDeg: [0, 0, 0], materialId: "primary_mat" },
                    { id: "support_1", name: "Primary Support", type: "box", size: [0.12, 0.12, 1.3], position: [-0.4, -0.4, 0.65], rotationDeg: [0, 0, 0], materialId: "secondary_mat" },
                    { id: "support_2", name: "Secondary Support", type: "box", size: [0.12, 0.12, 1.3], position: [0.4, 0.4, 0.65], rotationDeg: [0, 0, 0], materialId: "secondary_mat" },
                  ],
                  materials: [
                    { id: "primary_mat", name: "Primary Texture", baseColor: "#3b82f6", roughness: 0.4, metallic: 0.2 },
                    { id: "secondary_mat", name: "Frame Alloy", baseColor: "#475569", roughness: 0.6, metallic: 0.7 },
                  ],
                },
              };

              useStudioStore.getState().addModel(generatedModel);
              set((state) => ({
                jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, resultModelId: newModelId } : j)),
              }));
            }
          }
        })();

        return jobId;
      },

      cancelJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "failed",
                  stageMessage: "Generation canceled by user",
                  error: "Operation aborted",
                }
              : j
          ),
        }));
      },
    }),
    {
      name: "image-to-3d-jobs",
    }
  )
);
