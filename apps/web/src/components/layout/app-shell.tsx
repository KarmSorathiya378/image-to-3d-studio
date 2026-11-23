"use client";

import React, { useState } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { Inspector } from "./inspector";
import { ViewportControls } from "@/components/viewer/viewport-controls";
import { NewGenerationModal } from "@/components/generation/new-generation-modal";
import { useStudioStore } from "@/stores/studio-store";
import { useJobStore } from "@/stores/job-store";
// Import cleanly from packages/viewer via its public API!
import { Viewer } from "packages/viewer";

interface AppShellProps {
  children?: React.ReactNode;
  showStudioViewer?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  showStudioViewer = true,
}) => {
  const { models, activeModelId, viewerSettings } = useStudioStore();
  const { jobs, activeJobId } = useJobStore();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const activeModel = models.find((m) => m.id === activeModelId);
  const currentJob = jobs.find((j) => j.id === activeJobId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* 1. Universal Top Bar */}
      <TopBar
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onToggleMobileInspector={() => setMobileInspectorOpen(!mobileInspectorOpen)}
      />

      {/* 2. Main Body: Sidebar + Center Workspace + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Desktop) */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-64 bg-sidebar z-50 shadow-xl">
              <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Center Main Workspace */}
        <main className="flex-1 relative flex flex-col overflow-hidden bg-[var(--viewport-bg)] min-w-0">
          {showStudioViewer ? (
            <div className="relative w-full h-full flex-1 overflow-hidden">
              {/* Floating Viewport HUD Controls */}
              <ViewportControls />

              {/* 3D Viewport Area - mounts Viewer from packages/viewer! */}
              <Viewer
                model={activeModel}
                sceneSpec={activeModel?.sceneSpec}
                wireframe={viewerSettings.wireframe}
                showGrid={viewerSettings.showGrid}
                autoRotate={viewerSettings.autoRotate}
                lightingPreset={viewerSettings.lightingPreset}
                className="w-full h-full"
              />

              {/* Active Generation Progress Banner (if job running) */}
              {currentJob && currentJob.status !== "succeeded" && currentJob.status !== "failed" && (
                <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto p-3 rounded-lg bg-card/90 backdrop-blur-md border border-primary/30 shadow-xl z-20 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Generating 3D Asset
                    </span>
                    <span className="font-mono text-primary font-bold">
                      {currentJob.progressPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${currentJob.progressPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {currentJob.stageMessage}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full overflow-y-auto p-4 sm:p-6 bg-background">
              {children}
            </div>
          )}
        </main>

        {/* Right Inspector (Desktop) */}
        {showStudioViewer && (
          <div className="hidden lg:block">
            <Inspector />
          </div>
        )}

        {/* Mobile Inspector Overlay */}
        {mobileInspectorOpen && showStudioViewer && (
          <div className="fixed inset-0 z-40 lg:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-xs"
              onClick={() => setMobileInspectorOpen(false)}
            />
            <div className="relative w-80 bg-card z-50 shadow-xl">
              <Inspector />
            </div>
          </div>
        )}
      </div>

      {/* New Generation Wizard Modal */}
      <NewGenerationModal />
    </div>
  );
};
