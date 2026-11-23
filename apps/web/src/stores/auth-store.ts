import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const DEFAULT_USER: User = {
  id: "usr_solademo",
  name: "Studio Creator",
  email: "creator@studio3d.ai",
  role: "creator",
  createdAt: Date.now() - 86400000 * 7,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: DEFAULT_USER,
      isAuthenticated: true,
      login: async (email, pass) => {
        if (!email || !pass) {
          return { success: false, error: "Email and password are required" };
        }
        if (pass.length < 6) {
          return { success: false, error: "Password must be at least 6 characters" };
        }
        const user: User = {
          id: `usr_${Date.now().toString(36)}`,
          name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          email,
          role: "creator",
          createdAt: Date.now(),
        };
        set({ user, isAuthenticated: true });
        return { success: true };
      },
      register: async (name, email, pass) => {
        if (!name || !email || !pass) {
          return { success: false, error: "All fields are required" };
        }
        if (pass.length < 6) {
          return { success: false, error: "Password must be at least 6 characters" };
        }
        const user: User = {
          id: `usr_${Date.now().toString(36)}`,
          name,
          email,
          role: "creator",
          createdAt: Date.now(),
        };
        set({ user, isAuthenticated: true });
        return { success: true };
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: "image-to-3d-auth",
    }
  )
);
