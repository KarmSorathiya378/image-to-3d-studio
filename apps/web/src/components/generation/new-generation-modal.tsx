"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Cpu,
  Sliders,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import { useJobStore } from "@/stores/job-store";
import { useProviderStore } from "@/stores/provider-store";
import type { GenerationConfig } from "@/types";

export const NewGenerationModal: React.FC = () => {
  const { activeModal, setActiveModal, activeProjectId } = useStudioStore();
  const { startGeneration } = useJobStore();
  const { providers } = useProviderStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [promptNotes, setPromptNotes] = useState("");
  const [detailLevel, setDetailLevel] = useState<"simple" | "standard" | "high">("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Vision providers with vision capability
  const visionProviders = providers.filter((p) =>
    p.supportedCapabilities.includes("vision")
  );
  const defaultVision = visionProviders.find((p) => p.isDefaultVision) || visionProviders[0];
  const [selectedVisionProvider, setSelectedVisionProvider] = useState(defaultVision?.id || "openai");
  const [selectedVisionModel, setSelectedVisionModel] = useState(defaultVision?.models[0]?.id || "gpt-4o");

  // Planner providers with structured output / code generation
  const plannerProviders = providers.filter(
    (p) =>
      p.supportedCapabilities.includes("structuredOutput") ||
      p.supportedCapabilities.includes("codeGeneration")
  );
  const defaultPlanner = plannerProviders.find((p) => p.isDefaultPlanner) || plannerProviders[0];
  const [selectedPlannerProvider, setSelectedPlannerProvider] = useState(defaultPlanner?.id || "inception");
  const [selectedPlannerModel, setSelectedPlannerModel] = useState(
    defaultPlanner?.models[0]?.id || "mercury-coder-v1"
  );

  if (activeModal !== "new-generation") return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("File size exceeds 15MB limit");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      setErrorMsg("Please upload a photograph of an object first");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const config: GenerationConfig = {
      visionProvider: selectedVisionProvider,
      visionModel: selectedVisionModel,
      plannerProvider: selectedPlannerProvider,
      plannerModel: selectedPlannerModel,
      promptNotes,
      detailLevel,
      coordinateSystem: "Z_UP",
    };

    try {
      await startGeneration(
        activeProjectId,
        imageFile?.name || "photo_input.jpg",
        imagePreview,
        config
      );
      setIsSubmitting(false);
      setActiveModal(null);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || "Failed to initiate generation");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-generation-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 id="new-generation-title" className="text-sm font-bold text-foreground">
                Generate 3D from Photograph
              </h2>
              <p className="text-[11px] text-muted-foreground">
                VLM visual analysis &rarr; SceneSpec schema &rarr; deterministic Blender geometry
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Image Upload Area */}
          <div>
            <label className="text-[11px] font-semibold text-foreground uppercase block mb-1">
              Source Photograph
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[140px] ${
                imagePreview
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload photo"
              />

              {imagePreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={imagePreview}
                    alt="Uploaded reference preview"
                    className="h-28 object-contain rounded border border-border shadow-sm"
                  />
                  <span className="text-[11px] text-primary font-medium hover:underline">
                    Click or drop to replace photo
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-xs">
                      Click to upload or drag photo here
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Single object photo (stool, chair, lamp, prop) on plain background
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Prompt & Reference Notes */}
          <div>
            <label className="text-[11px] font-semibold text-foreground uppercase block mb-1">
              Optional Geometric Guidance
            </label>
            <input
              type="text"
              value={promptNotes}
              onChange={(e) => setPromptNotes(e.target.value)}
              placeholder="e.g. Scandinavian wooden stool, round seat, 4 legs splayed"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Dual AI Provider Selection (Vision & Planner) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
            {/* Vision Model */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block">
                1. Vision Analysis Model
              </label>
              <select
                value={selectedVisionModel}
                onChange={(e) => setSelectedVisionModel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-xs outline-none"
              >
                {visionProviders.flatMap((p) =>
                  p.models
                    .filter((m) => m.capabilities.includes("vision"))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {p.displayName} - {m.name}
                      </option>
                    ))
                )}
              </select>
            </div>

            {/* Planner Model */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase block">
                2. Geometry Planning Model
              </label>
              <select
                value={selectedPlannerModel}
                onChange={(e) => setSelectedPlannerModel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-xs outline-none"
              >
                {plannerProviders.flatMap((p) =>
                  p.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {p.displayName} - {m.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Detail Level Selector */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
              Geometry Fidelity Target
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "simple", label: "Simple", desc: "Low-poly prototype" },
                { id: "standard", label: "Standard", desc: "Balanced PBR mesh" },
                { id: "high", label: "High", desc: "Detailed primitives" },
              ].map((lvl) => (
                <button
                  type="button"
                  key={lvl.id}
                  onClick={() => setDetailLevel(lvl.id as any)}
                  className={`p-2 rounded border text-left transition-colors ${
                    detailLevel === lvl.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs font-semibold">{lvl.label}</span>
                  <span className="block text-[9px] text-muted-foreground">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notice & Disclaimer */}
          <div className="p-2.5 rounded bg-muted/40 border border-border text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <span>
              <strong>BYOK Policy:</strong> Generation calls your selected provider API with your
              configured keys. Resulting meshes are deterministic and verifiable in 3D.
            </span>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-3 py-2 rounded-md border border-border hover:bg-muted font-medium text-foreground text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !imagePreview}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to Queue...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Generation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
