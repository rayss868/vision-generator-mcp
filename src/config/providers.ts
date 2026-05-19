import { z } from 'zod';

const ProviderConfigSchema = z.object({
  baseUrl: z.string().url().describe('Provider base URL, for example https://api.provider-a.com/v1'),
  apiKey: z.string().min(1).describe('Provider API key from MCP settings'),
  providerTimeoutMs: z.coerce.number().int().positive().default(120000).describe('Provider request timeout in milliseconds'),
  downloadTimeoutMs: z.coerce.number().int().positive().default(120000).describe('Binary download timeout in milliseconds'),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export function loadProviderConfig(): ProviderConfig {
  const candidate = {
    baseUrl: process.env.PROVIDER_BASE_URL,
    apiKey: process.env.PROVIDER_API_KEY,
    providerTimeoutMs: process.env.PROVIDER_TIMEOUT_MS,
    downloadTimeoutMs: process.env.DOWNLOAD_TIMEOUT_MS,
  };

  return ProviderConfigSchema.parse(candidate);
}
