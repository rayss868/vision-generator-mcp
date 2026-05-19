import type { ProviderConfig } from '../config/providers.js';
import type { ProviderAdapter } from './base-provider.js';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter.js';

export function createProviderAdapter(config: ProviderConfig): ProviderAdapter {
  return new OpenAICompatibleAdapter({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    providerTimeoutMs: config.providerTimeoutMs,
    downloadTimeoutMs: config.downloadTimeoutMs,
  });
}
