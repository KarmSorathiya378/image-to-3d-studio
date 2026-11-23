"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  PlusCircle,
  Box,
  History,
  KeyRound,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Cpu,
} from "lucide-react";
import { useStudioStore } from "@/stores/studio-store";
import { useJobStore } from "@/stores/job-store";
import { useProviderStore } from "@/stores/provider-store";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, setActiveModal, projects, models } = useStudioStore();
  const { jobs } = useJobStore();
  const { providers } = useProviderStore();

  const activeJobsCount = jobs.filter(
    (j) => j.status !== "succeeded" && j.status !== "failed"
  ).length;

  const configuredProvidersCount = providers.filter((p) => p.apiKeyMasked).length;

  const navItems = [
    {
      title: "Projects",
      href: "/app",
      icon: FolderKanban,
      badge: projects.length,
    },
    {
      title: "Model Library",
      href: "/app/models",
      icon: Box,
      badge: models.length,
    },
    {
      title: "Generation History",
      href: "/app/jobs",
      icon: History,
      badge: activeJobsCount > 0 ? `${activeJobsCount} active` : jobs.length,
      badgeColor: activeJobsCount > 0 ? "bg-amber-500 text-amber-950 font-bold" : undefined,
    },
    {
      title: "AI Providers (BYOK)",
      href: "/app/settings/providers",
      icon: KeyRound,
      badge: `${configuredProvidersCount}/${providers.length}`,
    },
    {
      title: "Settings",
      href: "/app/settings/account",
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] bg-sidebar border-r border-sidebar-border transition-all duration-200 flex flex-col justify-between select-none z-20 ${
        sidebarCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Top: New Generation CTA & Main Navigation */}
      <div className="p-3 flex flex-col gap-3">
        {/* New Generation Button (Primary Action) */}
        <button
          onClick={() => {
            setActiveModal("new-generation");
            onCloseMobile?.();
          }}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:bg-primary/90 transition-all ${
            sidebarCollapsed ? "px-0" : ""
          }`}
          title="Start new image-to-3D generation"
          aria-label="New Generation"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>New Generation</span>}
        </button>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1 mt-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app" || pathname.startsWith("/app/projects")
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground"
                } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                title={sidebarCollapsed ? item.title : undefined}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
                </div>

                {!sidebarCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      item.badgeColor || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Storage & Engine Status & Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border flex flex-col gap-2">
        {!sidebarCollapsed && (
          <div className="p-2.5 rounded-md bg-muted/40 border border-border flex flex-col gap-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-foreground font-medium">
                <Cpu className="w-3 h-3 text-primary" />
                Geometry Engine
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-[10px] leading-tight">Blender 4.2 LTS Mesh Worker ready</p>
          </div>
        )}

        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs w-full px-2">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Menu</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
