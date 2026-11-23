"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("creator@studio3d.ai");
  const [password, setPassword] = useState("studio-pass-123");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrorMsg(result.error.errors[0]?.message || "Validation failed");
      return;
    }

    setIsSubmitting(true);
    const authRes = await login(email, password);
    setIsSubmitting(false);

    if (authRes.success) {
      router.push("/app");
    } else {
      setErrorMsg(authRes.error || "Authentication failed");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl border border-border bg-card shadow-xl space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-md mb-2">
          3D
        </div>
        <h1 className="text-xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-xs text-muted-foreground">
          Sign in to your AI Image-to-3D Studio workspace
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-foreground block mb-1.5" htmlFor="login-email">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-semibold text-foreground" htmlFor="login-password">
              Password
            </label>
            <a href="#" className="text-[11px] text-primary hover:underline">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Sign In to Studio</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
};
