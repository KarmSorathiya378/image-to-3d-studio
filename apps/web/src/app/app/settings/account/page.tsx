"use client";

import React from "react";
import { User, Shield, Moon, Sun, Laptop, Eye, LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "next-themes";
import { formatDate } from "@/lib/utils";

export default function AccountSettingsPage() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  return (
    <AppShell showStudioViewer={false}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Account & Workspace Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your profile, active theme, and security settings
          </p>
        </div>

        {/* Profile Card */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 text-primary font-bold text-xl flex items-center justify-center border border-primary/30">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">{user?.name || "Studio User"}</h2>
              <p className="text-xs text-muted-foreground">{user?.email || "user@studio3d.ai"}</p>
              <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase font-mono">
                {user?.role || "Creator"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border text-xs">
            <div className="p-2.5 rounded bg-muted/40">
              <span className="text-[10px] text-muted-foreground block">Account ID</span>
              <span className="font-mono text-foreground">{user?.id || "usr_guest"}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/40">
              <span className="text-[10px] text-muted-foreground block">Member Since</span>
              <span className="text-foreground">
                {user?.createdAt ? formatDate(user.createdAt) : "Recently"}
              </span>
            </div>
          </div>
        </div>

        {/* Theme Preferences */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-foreground">Theme & Visual Comfort</h3>
          <p className="text-xs text-muted-foreground">
            Choose your preferred color theme or high contrast mode for 3D inspection
          </p>

          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { id: "dark", label: "Dark Studio", icon: Moon, desc: "Default low glare" },
              { id: "light", label: "Clean Light", icon: Sun, desc: "High illumination" },
              { id: "contrast", label: "High Contrast", icon: Eye, desc: "Maximum a11y" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  theme === t.id
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                <t.icon className="w-4 h-4 mb-1.5" />
                <span className="block text-xs font-bold text-foreground">{t.label}</span>
                <span className="block text-[10px] text-muted-foreground">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sign Out Card */}
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-xs text-destructive">Sign Out of Session</h4>
            <p className="text-[11px] text-muted-foreground">
              Clear local cached credentials and return to the sign-in screen
            </p>
          </div>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 rounded-md bg-destructive text-destructive-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-destructive/90 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
