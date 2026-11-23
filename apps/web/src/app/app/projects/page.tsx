"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, Box, Calendar, Clock, ArrowRight, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useStudioStore } from "@/stores/studio-store";
import { formatDate } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, selectProject, setActiveModal } = useStudioStore();

  const handleOpenProject = (id: string) => {
    selectProject(id);
    router.push("/app");
  };

  return (
    <AppShell showStudioViewer={false}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Projects Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Organize your image-to-3D models and generations
            </p>
          </div>
          <button
            onClick={() => setActiveModal("new-generation")}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Generation</span>
          </button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => handleOpenProject(proj.id)}
              className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer shadow-xs flex flex-col justify-between h-44 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {proj.modelsCount} {proj.modelsCount === 1 ? "model" : "models"}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {proj.name}
                </h3>
                {proj.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {proj.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/60">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {formatDate(proj.updatedAt)}
                </span>
                <span className="text-primary font-semibold flex items-center gap-0.5 text-xs group-hover:translate-x-0.5 transition-transform">
                  Open Studio <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
