"use client";

import React, { useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Activity,
  Sparkles,
  Lock,
  Cpu,
} from "lucide-react";
import { useProviderStore } from "@/stores/provider-store";
import type { ProviderId } from "@/types";

export const ProviderManager: React.FC = () => {
  const {
    providers,
    saveKey,
    deleteKey,
    testKey,
    setDefaultVision,
    setDefaultPlanner,
  } = useProviderStore();

  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; latency?: number }>>({});

  const handleSave = async (id: ProviderId) => {
    const key = inputKeys[id];
    if (!key) return;
    const ok = await saveKey(id, key, nicknames[id]);
    if (ok) {
      setInputKeys((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleTest = async (id: ProviderId) => {
    setTestingId(id);
    const result = await testKey(id);
    setTestingId(null);
    setTestResults((prev) => ({
      ...prev,
      [id]: { ok: result.ok, msg: result.message, latency: result.latencyMs },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">AI Provider Credentials (BYOK)</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Connect your own API accounts. Credentials are encrypted at rest with AES-256-GCM and never
          shared with third parties. Used strictly for image analysis and SceneSpec geometry planning.
        </p>
      </div>

      {/* Security Guarantee Box */}
      <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">Zero Plaintext Storage Guarantee</p>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            API keys are submitted over TLS, encrypted in an isolated vault, and referenced by cryptographic
            identifier. The client application only displays the masked key snippet.
          </p>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p) => {
          const hasKey = !!p.apiKeyMasked;
          const isTesting = testingId === p.id;
          const testRes = testResults[p.id];

          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 space-y-3 transition-all ${
                hasKey
                  ? "bg-card border-border shadow-xs"
                  : "bg-muted/20 border-dashed border-border"
              }`}
            >
              {/* Card Header: Name & Status */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">{p.displayName}</h3>
                    <a
                      href={p.officialDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Read official API documentation"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {p.nickname && (
                    <span className="text-[10px] text-muted-foreground">{p.nickname}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                      p.status === "verified"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : p.status === "untested"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>

              {/* Supported Capabilities Chips */}
              <div className="flex flex-wrap gap-1">
                {p.supportedCapabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground capitalize"
                  >
                    {cap}
                  </span>
                ))}
              </div>

              {/* Masked Key Display or Input */}
              {hasKey ? (
                <div className="space-y-2 pt-1 border-t border-border">
                  <div className="flex items-center justify-between p-2 rounded bg-muted/40 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground">{p.apiKeyMasked}</span>
                    </div>
                    <button
                      onClick={() => deleteKey(p.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                      title="Revoke and delete key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Actions: Test latency + Defaults */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      onClick={() => handleTest(p.id)}
                      disabled={isTesting}
                      className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground font-medium flex items-center gap-1.5 text-[11px] transition-colors border border-border"
                    >
                      <Activity className={`w-3 h-3 ${isTesting ? "animate-spin text-primary" : ""}`} />
                      <span>{isTesting ? "Pinging..." : "Test Latency"}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {p.supportedCapabilities.includes("vision") && (
                        <button
                          onClick={() => setDefaultVision(p.id)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            p.isDefaultVision
                              ? "bg-primary text-primary-foreground font-bold border-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Default Vision
                        </button>
                      )}

                      {(p.supportedCapabilities.includes("structuredOutput") ||
                        p.supportedCapabilities.includes("codeGeneration")) && (
                        <button
                          onClick={() => setDefaultPlanner(p.id)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            p.isDefaultPlanner
                              ? "bg-primary text-primary-foreground font-bold border-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Default Planner
                        </button>
                      )}
                    </div>
                  </div>

                  {testRes && (
                    <p
                      className={`text-[10px] mt-1 ${
                        testRes.ok ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {testRes.msg} {testRes.latency ? `(${testRes.latency}ms)` : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1 border-t border-border">
                  <input
                    type="password"
                    placeholder={`Paste ${p.displayName} API Key`}
                    value={inputKeys[p.id] || ""}
                    onChange={(e) =>
                      setInputKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground text-xs font-mono outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Key nickname (e.g. Work Key)"
                      value={nicknames[p.id] || ""}
                      onChange={(e) =>
                        setNicknames((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="flex-1 px-2 py-1 rounded border border-border bg-background text-[11px] text-foreground outline-none"
                    />
                    <button
                      onClick={() => handleSave(p.id)}
                      disabled={!inputKeys[p.id]}
                      className="px-3 py-1 rounded bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-xs"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
