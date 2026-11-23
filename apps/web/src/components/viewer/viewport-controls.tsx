"use client";

import React, { useState } from "react";
import {
  RotateCcw,
  Grid,
  Box,
  Sun,
  Camera,
  Play,
  Pause,
  Maximize,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import type { LightingPreset } from "@/types";

interface ViewportControlsProps {
  onResetCamera?: () => void;
  onSnapshot?: () => void;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  onResetCamera,
  onSnapshot,
}) => {
  const {
    viewerSettings,
    toggleWireframe,
    toggleGrid,
    toggleAutoRotate,
    setLightingPreset,
  } = useStudioStore();

  const [lightingOpen, setLightingOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const presets: { id: LightingPreset; label: string }[] = [
    { id: "studio", label: "Studio (Neutral)" },
    { id: "outdoor", label: "Outdoor Sun" },
    { id: "cyberpunk", label: "Cyberpunk Neon" },
    { id: "softWarm", label: "Soft Warm Interior" },
  ];

  const handleReset = () => {
    // Dispatch keyboard Home / R event to active canvas region
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    onResetCamera?.();
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSnapshot = () => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `3d_studio_snapshot_${Date.now()}.png`;
      a.click();
    }
    onSnapshot?.();
  };

  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none select-none z-10">
      {/* Left HUD: Viewport controls (Wireframe, Grid, Lighting, Auto-rotate) */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-card/85 backdrop-blur-md border border-border shadow-md pointer-events-auto">
        {/* Wireframe toggle */}
        <button
          onClick={toggleWireframe}
          className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
            viewerSettings.wireframe
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Toggle Wireframe Shading (Hotkey: W)"
          aria-label="Toggle Wireframe"
          aria-pressed={viewerSettings.wireframe}
        >
          <Box className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Wireframe</span>
        </button>

        {/* Grid toggle */}
        <button
          onClick={toggleGrid}
          className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
            viewerSettings.showGrid
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Toggle Ground Grid (Hotkey: G)"
          aria-label="Toggle Ground Grid"
          aria-pressed={viewerSettings.showGrid}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Grid</span>
        </button>

        {/* Auto Rotate toggle */}
        <button
          onClick={toggleAutoRotate}
          className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
            viewerSettings.autoRotate
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Toggle 360 Turntable Auto-Rotate"
          aria-label="Toggle Auto Rotate"
          aria-pressed={viewerSettings.autoRotate}
        >
          {viewerSettings.autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">Rotate</span>
        </button>

        {/* Lighting preset dropdown */}
        <div className="relative">
          <button
            onClick={() => setLightingOpen(!lightingOpen)}
            className="p-1.5 rounded-md text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Lighting Setup"
            aria-label="Lighting Preset"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline capitalize">{viewerSettings.lightingPreset}</span>
          </button>

          {lightingOpen && (
            <div className="absolute left-0 mt-1 w-44 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1 z-50">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setLightingPreset(p.id);
                    setLightingOpen(false);
                  }}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded transition-colors ${
                    viewerSettings.lightingPreset === p.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right HUD: Camera reset, Snapshot, Fullscreen, Keyboard Help */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-card/85 backdrop-blur-md border border-border shadow-md pointer-events-auto">
        <button
          onClick={handleReset}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Reset Camera Framing (Hotkey: R / Home)"
          aria-label="Reset Camera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleSnapshot}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Save 2D Render Snapshot"
          aria-label="Save Snapshot"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleFullscreen}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Navigation Help & Shortcuts"
            aria-label="Help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {helpOpen && (
            <div className="absolute right-0 mt-1 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-3 text-xs z-50">
              <h4 className="font-bold text-foreground mb-2">3D Navigation Controls</h4>
              <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                <li className="flex justify-between">
                  <span>Orbit:</span>
                  <span className="font-mono text-foreground">Left Drag / Arrows</span>
                </li>
                <li className="flex justify-between">
                  <span>Zoom:</span>
                  <span className="font-mono text-foreground">Scroll / +/-</span>
                </li>
                <li className="flex justify-between">
                  <span>Pan:</span>
                  <span className="font-mono text-foreground">Right Drag / Shift</span>
                </li>
                <li className="flex justify-between">
                  <span>Reset:</span>
                  <span className="font-mono text-foreground">R / Home</span>
                </li>
              </ul>
              <button
                onClick={() => setHelpOpen(false)}
                className="mt-2.5 w-full py-1 text-center font-semibold text-primary rounded hover:bg-muted text-[11px]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
