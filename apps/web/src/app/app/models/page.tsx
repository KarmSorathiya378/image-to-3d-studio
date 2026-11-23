"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Box, Download, Eye, Sparkles, Plus, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useStudioStore } from "@/stores/studio-store";
import { formatBytes, formatDate } from "@/lib/utils";

export default function ModelsPage() {
  const router = useRouter();
  const { models, selectModel, exportModel, setActiveModal } = useStudioStore();

  const handleViewModel = (id: string) => {
    selectModel(id);
    router.push("/app");
  };

  return (
    <AppShell showStudioViewer={false}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">3D Model Library</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified procedural 3D meshes ready for inspection and export
            </p>
          </div>
          <button
            onClick={() => setActiveModal("new-generation")}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New</span>
          </button>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 uppercase">
                    {m.format}
                  </span>
                  <span className="text-[10px] text-muted-foreground">v{m.version}.0</span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground truncate">{m.name}</h3>
                  {m.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {m.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/40 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Polygons</span>
                    <span className="font-semibold text-foreground">
                      {m.triangles.toLocaleString()} tris
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">File Size</span>
                    <span className="font-semibold text-foreground">{formatBytes(m.sizeBytes)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
                <button
                  onClick={() => handleViewModel(m.id)}
                  className="flex-1 py-1.5 px-2.5 rounded bg-card hover:bg-muted border border-border text-foreground font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Inspect in 3D</span>
                </button>
                <button
                  onClick={() => {
                    selectModel(m.id);
                    exportModel("glb");
                  }}
                  className="py-1.5 px-3 rounded bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shadow-xs hover:bg-primary/90 transition-colors"
                  title="Download GLB"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>GLB</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
