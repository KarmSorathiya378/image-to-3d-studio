"use client";

import React, { useState, useEffect } from "react";
import {
  Info,
  Boxes,
  Palette,
  Maximize2,
  Sparkles,
  Download,
  Check,
  AlertCircle,
  Copy,
  Layers,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import { formatBytes, formatDate } from "@/lib/utils";

export const Inspector: React.FC = () => {
  const {
    models,
    activeModelId,
    inspectorTab,
    setInspectorTab,
    updateModelMaterial,
    exportModel,
  } = useStudioStore();

  const [copiedId, setCopiedId] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"glb" | "obj" | "stl">("glb");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const model = models.find((m) => m.id === activeModelId);

  const handleCopyId = () => {
    if (!model) return;
    navigator.clipboard.writeText(model.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const tabs = [
    { id: "info", label: "Model", icon: Info },
    { id: "geometry", label: "Geometry", icon: Boxes },
    { id: "materials", label: "Materials", icon: Palette },
    { id: "config", label: "Pipeline", icon: Sparkles },
    { id: "export", label: "Export", icon: Download },
  ] as const;

  if (!model) {
    return (
      <aside className="w-80 h-[calc(100vh-3.5rem)] bg-card border-l border-border p-6 flex flex-col items-center justify-center text-center text-muted-foreground select-none">
        <Boxes className="w-10 h-10 mb-3 opacity-30 text-primary" />
        <p className="text-sm font-medium text-foreground">No Model Selected</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          Select or generate a 3D model to inspect geometry, materials, and pipeline metadata.
        </p>
      </aside>
    );
  }

  const spec = model.sceneSpec;

  return (
    <aside className="w-80 h-[calc(100vh-3.5rem)] bg-card border-l border-border flex flex-col justify-between select-none z-20">
      {/* Top: Header & Tab Bar */}
      <div>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              3D Inspector
            </h2>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
            v{model.version}.0
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-border bg-muted/30 p-1 gap-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = inspectorTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setInspectorTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-card text-primary font-bold shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5 mb-0.5" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-13rem)] space-y-4 text-xs">
          {/* TAB 1: MODEL INFO */}
          {inspectorTab === "info" && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Asset Title
                </label>
                <p className="font-semibold text-sm text-foreground">{model.name}</p>
                {model.description && (
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                    {model.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Format</span>
                  <span className="font-semibold text-foreground uppercase">{model.format}</span>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">File Size</span>
                  <span className="font-semibold text-foreground">
                    {formatBytes(model.sizeBytes)}
                  </span>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Status</span>
                  <span className="font-semibold text-emerald-500 capitalize">{model.status}</span>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Created</span>
                  <span className="font-semibold text-foreground">
                    {mounted ? formatDate(model.createdAt) : "—"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <span className="text-[10px] text-muted-foreground block mb-1">Asset ID</span>
                <div className="flex items-center justify-between p-1.5 rounded bg-muted/60 font-mono text-[10px] text-muted-foreground">
                  <span className="truncate">{model.id}</span>
                  <button
                    onClick={handleCopyId}
                    className="p-1 hover:text-foreground text-muted-foreground rounded"
                    title="Copy asset ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GEOMETRY INFO */}
          {inspectorTab === "geometry" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Triangles</span>
                  <span className="text-base font-bold text-foreground">
                    {model.triangles.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Vertices</span>
                  <span className="text-base font-bold text-foreground">
                    {model.vertices.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Bounding Box Dimensions */}
              <div className="p-3 rounded bg-muted/30 border border-border space-y-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                  Bounding Dimensions (X, Y, Z)
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-1.5 bg-background rounded border border-border">
                    <span className="text-[10px] text-muted-foreground block">Width (X)</span>
                    <span className="font-bold text-foreground">{model.dimensions.width}m</span>
                  </div>
                  <div className="p-1.5 bg-background rounded border border-border">
                    <span className="text-[10px] text-muted-foreground block">Height (Y)</span>
                    <span className="font-bold text-foreground">{model.dimensions.height}m</span>
                  </div>
                  <div className="p-1.5 bg-background rounded border border-border">
                    <span className="text-[10px] text-muted-foreground block">Depth (Z)</span>
                    <span className="font-bold text-foreground">{model.dimensions.depth}m</span>
                  </div>
                </div>
              </div>

              {/* Parts Breakdown */}
              {spec?.parts && spec.parts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Constructed Parts ({spec.parts.length})</span>
                    <span>Primitive</span>
                  </div>
                  <div className="space-y-1">
                    {spec.parts.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-foreground truncate">{p.name || p.id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {p.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MATERIAL DETAILS */}
          {inspectorTab === "materials" && (
            <div className="space-y-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                PBR Material Channels
              </span>

              {spec?.materials && spec.materials.length > 0 ? (
                spec.materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-3 rounded bg-muted/30 border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{mat.name || mat.id}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{mat.id}</span>
                    </div>

                    {/* Base Color Picker */}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={mat.baseColor}
                          onChange={(e) =>
                            updateModelMaterial(mat.id, { baseColor: e.target.value })
                          }
                          className="w-6 h-6 rounded cursor-pointer border border-border"
                          title="Click to change material base color"
                        />
                        <span className="font-mono text-[10px] text-foreground uppercase">
                          {mat.baseColor}
                        </span>
                      </div>
                    </div>

                    {/* Roughness Slider */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Roughness</span>
                        <span className="font-mono">{mat.roughness.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={mat.roughness}
                        onChange={(e) =>
                          updateModelMaterial(mat.id, { roughness: parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary h-1.5 rounded bg-muted cursor-pointer"
                        title="Adjust surface roughness"
                      />
                    </div>

                    {/* Metallic Slider */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Metallic</span>
                        <span className="font-mono">{mat.metallic.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={mat.metallic}
                        onChange={(e) =>
                          updateModelMaterial(mat.id, { metallic: parseFloat(e.target.value) })
                        }
                        className="w-full accent-primary h-1.5 rounded bg-muted cursor-pointer"
                        title="Adjust metallic reflection"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-muted-foreground bg-muted/20 rounded">
                  No editable material layers attached.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GENERATION CONFIG */}
          {inspectorTab === "config" && (
            <div className="space-y-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                BYOK Pipeline Provenance
              </span>

              <div className="space-y-2">
                <div className="p-2.5 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Vision Interpreter</span>
                  <span className="font-semibold text-foreground">OpenAI GPT-4o Vision</span>
                </div>
                <div className="p-2.5 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Geometry Planner</span>
                  <span className="font-semibold text-foreground">Inception Mercury Coder</span>
                </div>
                <div className="p-2.5 rounded bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Coordinate System</span>
                  <span className="font-semibold text-foreground">
                    {spec?.coordinateSystem || "Z_UP"} (Deterministic)
                  </span>
                </div>
              </div>

              {spec?.uncertaintyNotes && spec.uncertaintyNotes.length > 0 && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <div className="flex items-center gap-1 font-semibold text-[11px] mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Uncertainty Notice</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] leading-relaxed">
                    {spec.uncertaintyNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EXPORT SETTINGS */}
          {inspectorTab === "export" && (
            <div className="space-y-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Target Export Format
              </span>

              <div className="space-y-1.5">
                {[
                  { id: "glb", name: "glTF Binary (.glb)", desc: "Web & game ready, embedded PBR materials" },
                  { id: "obj", name: "Wavefront (.obj)", desc: "Universal 3D geometry with material list" },
                  { id: "stl", name: "Stereolithography (.stl)", desc: "3D printing mesh slice compatible" },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id as any)}
                    className={`w-full p-2.5 rounded border text-left transition-colors flex items-center justify-between ${
                      selectedFormat === fmt.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs block text-foreground">{fmt.name}</span>
                      <span className="text-[10px] text-muted-foreground">{fmt.desc}</span>
                    </div>
                    {selectedFormat === fmt.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => exportModel(selectedFormat)}
                  className="w-full py-2.5 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-all"
                  aria-label={`Download ${selectedFormat.toUpperCase()} Asset`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download {selectedFormat.toUpperCase()} Asset</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Quick Download Action */}
      <div className="p-3 border-t border-border bg-muted/20">
        <button
          onClick={() => exportModel("glb")}
          className="w-full py-2 px-3 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Quick Download GLB</span>
        </button>
      </div>
    </aside>
  );
};
