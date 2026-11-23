import { ProviderError } from '../types/errors.ts';
import { type IProviderAdapter, type ProviderIdType, ProviderId } from '../types/providers.ts';
import { AnthropicAdapter } from './anthropic.ts';
import { GeminiAdapter } from './gemini.ts';
import { GroqAdapter } from './groq.ts';
import { InceptionAdapter } from './inception.ts';
import { OpenAIAdapter } from './openai.ts';
import { MeshyAdapter } from './specialist/meshy.ts';
import { TripoAdapter } from './specialist/tripo.ts';

export * from './anthropic.ts';
export * from './base.ts';
export * from './gemini.ts';
export * from './groq.ts';
export * from './inception.ts';
export * from './openai.ts';
export * from './specialist/meshy.ts';
export * from './specialist/tripo.ts';

/**
 * Adapter Registry and Factory for all supported AI providers.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, IProviderAdapter>();

  constructor() {
    this.registerAdapter(new OpenAIAdapter());
    this.registerAdapter(new GroqAdapter());
    this.registerAdapter(new InceptionAdapter());
    this.registerAdapter(new GeminiAdapter());
    this.registerAdapter(new AnthropicAdapter());
    this.registerAdapter(new TripoAdapter());
    this.registerAdapter(new MeshyAdapter());
  }

  public registerAdapter(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.providerId.toLowerCase(), adapter);
  }

  public getAdapter(providerId: ProviderIdType | string): IProviderAdapter {
    const adapter = this.adapters.get(providerId.toLowerCase());
    if (!adapter) {
      throw new ProviderError({
        code: 'FEATURE_NOT_SUPPORTED',
        retryable: false,
        userMessage: `Provider "${providerId}" has no registered adapter. Supported providers: ${Array.from(
          this.adapters.keys()
        ).join(', ')}`,
      });
    }
    return adapter;
  }

  public hasAdapter(providerId: string): boolean {
    return this.adapters.has(providerId.toLowerCase());
  }

  public listAdapters(): readonly IProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
