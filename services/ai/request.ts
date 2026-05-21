import type { AIProvider } from '../../types';

export const AI_REQUEST_TIMEOUT_MS = 120_000;

export function supportsJSONResponseFormat(provider: AIProvider): boolean {
  return provider === 'openai' || provider === 'openrouter';
}

export function getJSONResponseFormatParam(provider: AIProvider): { response_format: { type: 'json_object' } } | {} {
  return supportsJSONResponseFormat(provider)
    ? { response_format: { type: 'json_object' as const } }
    : {};
}

export function isAbortLikeError(error: unknown): boolean {
  return (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError');
}

function createTimeoutError(timeoutMs: number): Error {
  return new Error(`AI request timed out after ${Math.round(timeoutMs / 1000)} seconds`);
}

function createTimeoutSignal(timeoutMs: number, upstreamSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(createTimeoutError(timeoutMs));
  }, timeoutMs);

  const abortFromUpstream = () => {
    controller.abort(upstreamSignal?.reason);
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    },
  };
}

export async function fetchWithAITimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs, init.signal ?? undefined);
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (isAbortLikeError(error) && signal.reason instanceof Error) {
      throw signal.reason;
    }
    throw error;
  } finally {
    cleanup();
  }
}

export async function withAITimeout<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const { signal: timeoutSignal, cleanup } = createTimeoutSignal(timeoutMs, signal);
  try {
    if (timeoutSignal.aborted) {
      throw timeoutSignal.reason instanceof Error ? timeoutSignal.reason : new DOMException('Aborted', 'AbortError');
    }
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutSignal.addEventListener('abort', () => {
          reject(timeoutSignal.reason instanceof Error ? timeoutSignal.reason : new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }),
    ]);
  } finally {
    cleanup();
  }
}
