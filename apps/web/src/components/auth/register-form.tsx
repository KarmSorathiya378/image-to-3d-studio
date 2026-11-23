"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { z } from "zod";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { register } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!agreeTerms) {
      setErrorMsg("Please accept the terms and conditions");
      return;
    }

    const result = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!result.success) {
      setErrorMsg(result.error.errors[0]?.message || "Validation failed");
      return;
    }

    setIsSubmitting(true);
    const authRes = await register(name, email, password);
    setIsSubmitting(false);

    if (authRes.success) {
      router.push("/app");
    } else {
      setErrorMsg(authRes.error || "Registration failed");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl border border-border bg-card shadow-xl space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-md mb-2">
          3D
        </div>
        <h1 className="text-xl font-bold text-foreground">Create Account</h1>
        <p className="text-xs text-muted-foreground">
          Start generating real, verifiable 3D models with your own AI keys
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
          <label className="font-semibold text-foreground block mb-1.5" htmlFor="reg-name">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Rivers"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1.5" htmlFor="reg-email">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1.5" htmlFor="reg-pass">
            Password (min 6 characters)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="reg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1.5" htmlFor="reg-conf">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="reg-conf"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs outline-none focus:border-primary transition-colors"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="terms"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary w-4 h-4"
          />
          <label htmlFor="terms" className="text-[11px] text-muted-foreground">
            I understand that single-image reconstruction produces approximate 3D geometry
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Creating account...</span>
          ) : (
            <>
              <span>Create Studio Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
};
