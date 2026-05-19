import { normalizeUnknownError } from './vision-service.js';

export function formatErrorForTool(error: unknown) {
  const normalized = normalizeUnknownError(error);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            error: {
              code: normalized.code,
              message: normalized.message,
              retryable: normalized.retryable,
              details: normalized.details ?? null,
            },
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

export function formatTextError(error: unknown) {
  return formatErrorForTool(error);
}
