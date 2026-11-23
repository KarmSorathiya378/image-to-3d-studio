"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Moon,
  Sun,
  Laptop,
  LogOut,
  User,
  Settings,
  FolderOpen,
  Eye,
  Sliders,
  Menu,
} from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import { useProviderStore } from "@/stores/provider-store";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "next-themes";

interface TopBarProps {
  onToggleMobileSidebar?: () => void;
  onToggleMobileInspector?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleMobileSidebar,
  onToggleMobileInspector,
}) => {
  const {
    projects,
    activeProjectId,
    updateProjectName,
    saveStatus,
    exportModel,
    activeModelId,
    models,
  } = useStudioStore();

  const { providers, setDefaultVision } = useProviderStore();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeModel = models.find((m) => m.id === activeModelId);
  const defaultVision = providers.find((p) => p.isDefaultVision) || providers[0];

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditingTitle(false);
    if (activeProject && e.target.value.trim()) {
      updateProjectName(activeProject.id, e.target.value.trim());
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Mobile Toggle & Project Title & Save Status */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <Link href="/app" className="font-bold text-sm tracking-tight flex items-center gap-1.5 mr-2 text-foreground">
            <span className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-sm">
              3D
            </span>
            <span className="hidden sm:inline">Studio</span>
          </Link>
          <span className="text-border">/</span>

          {isEditingTitle ? (
            <input
              type="text"
              defaultValue={activeProject?.name || "Untitled Project"}
              autoFocus
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="text-sm font-semibold bg-background px-2 py-0.5 border border-primary rounded outline-none w-48 text-foreground"
              aria-label="Project name input"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold hover:bg-muted/80 px-2 py-0.5 rounded transition-colors text-foreground flex items-center gap-1 max-w-[200px] truncate"
              title="Click to rename project"
            >
              <span className="truncate">{activeProject?.name || "Untitled Project"}</span>
            </button>
          )}

          {/* Save Status Badge */}
          <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-border text-muted-foreground bg-muted/40">
            {saveStatus === "saving" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="hidden sm:inline">Saved</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Center/Right: Active Provider, Export Action, Account Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Provider Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setProviderMenuOpen(!providerMenuOpen);
              setExportMenuOpen(false);
              setAccountMenuOpen(false);
            }}
            className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-foreground"
            aria-expanded={providerMenuOpen}
            aria-label="Select AI Provider"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">{defaultVision?.displayName || "AI Provider"}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                defaultVision?.status === "verified"
                  ? "bg-emerald-500"
                  : defaultVision?.status === "untested"
                  ? "bg-amber-500"
                  : "bg-muted-foreground"
              }`}
            />
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {providerMenuOpen && (
            <div className="absolute right-0 mt-1 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1.5 z-50">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
                Active AI Providers (BYOK)
              </div>
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setDefaultVision(p.id);
                    setProviderMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between text-xs px-2.5 py-2 rounded text-left transition-colors ${
                    p.isDefaultVision ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{p.displayName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.apiKeyMasked ? `Key: ${p.apiKeyMasked}` : "No key configured"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      p.status === "verified"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </span>
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <Link
                  href="/app/settings/providers"
                  onClick={() => setProviderMenuOpen(false)}
                  className="flex items-center gap-1.5 text-xs text-primary px-2.5 py-1.5 rounded hover:bg-muted"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Manage Provider Keys
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Export Button with Dropdown */}
        <div className="relative">
          <div className="flex items-center">
            <button
              onClick={() => exportModel("glb")}
              disabled={!activeModel}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-l-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              aria-label="Download GLB 3D Asset"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export GLB</span>
            </button>
            <button
              onClick={() => {
                setExportMenuOpen(!exportMenuOpen);
                setProviderMenuOpen(false);
                setAccountMenuOpen(false);
              }}
              disabled={!activeModel}
              className="p-1.5 rounded-r-md bg-primary/90 text-primary-foreground border-l border-primary-foreground/20 hover:bg-primary disabled:opacity-50"
              aria-label="Export formats dropdown"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1 z-50">
              <button
                onClick={() => {
                  exportModel("glb");
                  setExportMenuOpen(false);
                }}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted flex items-center justify-between"
              >
                <span>Binary glTF (.glb)</span>
                <span className="text-[10px] text-primary font-semibold">Standard</span>
              </button>
              <button
                onClick={() => {
                  exportModel("obj");
                  setExportMenuOpen(false);
                }}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted flex items-center justify-between"
              >
                <span>Wavefront (.obj)</span>
                <span className="text-[10px] text-muted-foreground">Mesh</span>
              </button>
              <button
                onClick={() => {
                  exportModel("stl");
                  setExportMenuOpen(false);
                }}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-muted flex items-center justify-between"
              >
                <span>Stereolithography (.stl)</span>
                <span className="text-[10px] text-muted-foreground">Print</span>
              </button>
            </div>
          )}
        </div>

        {/* Theme Switcher Toggle */}
        <div className="flex items-center border border-border rounded-md p-0.5 bg-background">
          <button
            onClick={() => setTheme("light")}
            className={`p-1 rounded ${mounted && theme === "light" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Light theme"
            aria-label="Light theme"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`p-1 rounded ${mounted && theme === "dark" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Dark theme"
            aria-label="Dark theme"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTheme("contrast")}
            className={`p-1 rounded ${mounted && theme === "contrast" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="High contrast theme"
            aria-label="High contrast theme"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Inspector Toggle */}
        {onToggleMobileInspector && (
          <button
            onClick={onToggleMobileInspector}
            className="lg:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            aria-label="Toggle Inspector Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* Account Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setAccountMenuOpen(!accountMenuOpen);
              setProviderMenuOpen(false);
              setExportMenuOpen(false);
            }}
            className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-primary/40 transition-all outline-none"
            aria-expanded={accountMenuOpen}
            aria-label="User Account Menu"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center border border-primary/30">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
          </button>

          {accountMenuOpen && (
            <div className="absolute right-0 mt-1 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-1.5 z-50">
              <div className="px-2.5 py-2 border-b border-border mb-1">
                <p className="text-xs font-semibold text-foreground truncate">{user?.name || "Studio User"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email || "user@studio.ai"}</p>
              </div>

              <Link
                href="/app/settings/account"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded hover:bg-muted text-foreground transition-colors"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Account Settings
              </Link>

              <Link
                href="/app/settings/providers"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded hover:bg-muted text-foreground transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                AI Providers (BYOK)
              </Link>

              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => {
                    logout();
                    setAccountMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors text-left font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
