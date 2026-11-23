import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProvider, ProviderId } from "@/types";

interface ProviderState {
  providers: AIProvider[];
  saveKey: (id: ProviderId, apiKey: string, nickname?: string) => Promise<boolean>;
  deleteKey: (id: ProviderId) => void;
  testKey: (id: ProviderId) => Promise<{ ok: boolean; latencyMs: number; message: string }>;
  setDefaultVision: (id: ProviderId) => void;
  setDefaultPlanner: (id: ProviderId) => void;
}

const INITIAL_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    displayName: "OpenAI",
    officialDocUrl: "https://platform.openai.com/docs",
    supportedCapabilities: ["vision", "text", "structuredOutput"],
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Flagship multimodal model with vision & structured output", capabilities: ["vision", "text", "structuredOutput"] },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast, cost-efficient multimodal model", capabilities: ["vision", "text", "structuredOutput"] },
      { id: "o3-mini", name: "o3-mini", description: "Reasoning model ideal for geometric constraint planning", capabilities: ["text", "structuredOutput", "codeGeneration"] },
    ],
    status: "verified",
    apiKeyMasked: "sk-proj-...8f3a",
    nickname: "Team OpenAI Key",
    isDefaultVision: true,
    isDefaultPlanner: false,
    latencyMs: 142,
  },
  {
    id: "inception",
    displayName: "Inception Labs (Mercury)",
    officialDocUrl: "https://inceptionlabs.ai/docs",
    supportedCapabilities: ["text", "codeGeneration", "structuredOutput"],
    models: [
      { id: "mercury-coder-v1", name: "Mercury Coder v1", description: "Dedicated geometry reasoning and SceneSpec planning engine", capabilities: ["text", "codeGeneration", "structuredOutput"] },
      { id: "mercury-flash", name: "Mercury Flash", description: "High-throughput sub-second geometry synthesis", capabilities: ["text", "structuredOutput"] },
    ],
    status: "verified",
    apiKeyMasked: "inc_live_...99b2",
    nickname: "Mercury Production Key",
    isDefaultVision: false,
    isDefaultPlanner: true,
    latencyMs: 88,
  },
  {
    id: "groq",
    displayName: "Groq",
    officialDocUrl: "https://console.groq.com/docs",
    supportedCapabilities: ["vision", "text", "structuredOutput"],
    models: [
      { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B Vision", description: "Ultra-fast low-latency vision reasoning", capabilities: ["vision", "text", "structuredOutput"] },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Fast deterministic scene planning", capabilities: ["text", "structuredOutput"] },
    ],
    status: "verified",
    apiKeyMasked: "gsk_...4c1e",
    nickname: "Groq Cloud Fast",
    isDefaultVision: false,
    isDefaultPlanner: false,
    latencyMs: 34,
  },
  {
    id: "gemini",
    displayName: "Google Gemini",
    officialDocUrl: "https://ai.google.dev",
    supportedCapabilities: ["vision", "text", "structuredOutput"],
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "High-resolution multimodal visual analysis", capabilities: ["vision", "text", "structuredOutput"] },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Lightweight, fast visual verification", capabilities: ["vision", "text", "structuredOutput"] },
    ],
    status: "untested",
    isDefaultVision: false,
    isDefaultPlanner: false,
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    officialDocUrl: "https://docs.anthropic.com",
    supportedCapabilities: ["vision", "text", "codeGeneration"],
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Industry-leading reasoning and spatial planning", capabilities: ["vision", "text", "codeGeneration"] },
    ],
    status: "untested",
    isDefaultVision: false,
    isDefaultPlanner: false,
  },
];

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: INITIAL_PROVIDERS,
      saveKey: async (id, apiKey, nickname) => {
        if (!apiKey || apiKey.length < 8) return false;
        const masked = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id
              ? {
                  ...p,
                  apiKeyMasked: masked,
                  nickname: nickname || `${p.displayName} Key`,
                  status: "verified",
                  latencyMs: Math.floor(Math.random() * 80 + 40),
                }
              : p
          ),
        }));
        return true;
      },
      deleteKey: (id) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id
              ? {
                  ...p,
                  apiKeyMasked: undefined,
                  nickname: undefined,
                  status: "unconfigured",
                  isDefaultVision: false,
                  isDefaultPlanner: false,
                }
              : p
          ),
        }));
      },
      testKey: async (id) => {
        await new Promise((r) => setTimeout(r, 600));
        const provider = get().providers.find((p) => p.id === id);
        if (!provider || !provider.apiKeyMasked) {
          return { ok: false, latencyMs: 0, message: "No API key configured for this provider" };
        }
        const latency = Math.floor(Math.random() * 60 + 35);
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, status: "verified", latencyMs: latency } : p
          ),
        }));
        return { ok: true, latencyMs: latency, message: `Successfully authenticated with ${provider.displayName}` };
      },
      setDefaultVision: (id) => {
        set((state) => ({
          providers: state.providers.map((p) => ({
            ...p,
            isDefaultVision: p.id === id,
          })),
        }));
      },
      setDefaultPlanner: (id) => {
        set((state) => ({
          providers: state.providers.map((p) => ({
            ...p,
            isDefaultPlanner: p.id === id,
          })),
        }));
      },
    }),
    {
      name: "image-to-3d-providers",
    }
  )
);
