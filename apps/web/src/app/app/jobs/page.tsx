"use client";

import React, { useState, useEffect } from "react";
import { History, CheckCircle2, AlertCircle, Clock, ArrowRight, Eye, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useJobStore } from "@/stores/job-store";
import { useStudioStore } from "@/stores/studio-store";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

export default function JobsPage() {
  const router = useRouter();
  const { jobs, cancelJob } = useJobStore();
  const { selectModel } = useStudioStore();

  const [expandedJobId, setExpandedJobId] = useState<string | null>(jobs[0]?.id || null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleViewModel = (modelId: string) => {
    selectModel(modelId);
    router.push("/app");
  };

  return (
    <AppShell showStudioViewer={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Generation History & Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time pipeline logs: Image Analysis &rarr; SceneSpec Planning &rarr; Blender Mesh Construction
          </p>
        </div>

        <div className="space-y-3">
          {jobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isSuccess = job.status === "succeeded";
            const isFailed = job.status === "failed";
            const inProgress = !isSuccess && !isFailed;

            return (
              <div
                key={job.id}
                className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
              >
                <div
                  onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isSuccess
                          ? "bg-emerald-500/10 text-emerald-500"
                          : isFailed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary animate-pulse"
                      }`}
                    >
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isFailed ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{job.sourceImageName}</h3>
                        <span className="text-[10px] font-mono text-muted-foreground">{job.id}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.stageMessage}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      {mounted ? formatDate(job.createdAt) : "—"}
                    </span>
                    {job.resultModelId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewModel(job.resultModelId!);
                        }}
                        className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shadow-xs hover:bg-primary/90"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect 3D</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Progress & Logs View */}
                {isExpanded && (
                  <div className="p-4 bg-muted/20 border-t border-border space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-xs">
                        Stage Pipeline Progress
                      </span>
                      <span className="font-mono text-primary font-bold">{job.progressPercent}%</span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${job.progressPercent}%` }}
                      />
                    </div>

                    {/* Pipeline Audit Logs */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                        Deterministic Execution Audit Trail
                      </span>
                      <div className="p-3 rounded-lg bg-background border border-border font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                        {job.logs.map((log, i) => (
                          <div key={i} className="flex items-start gap-2 text-muted-foreground">
                            <span className="text-primary shrink-0">&bull;</span>
                            <span className="text-[10px] text-muted-foreground/60 shrink-0">
                              {mounted ? new Date(log.timestamp).toLocaleTimeString() : "—"}
                            </span>
                            <span className="text-foreground">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
