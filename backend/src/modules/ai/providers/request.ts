export const AI_REQUEST_TIMEOUT_MS = 120_000;

export function supportsJSONResponseFormat(providerName: string): boolean {
  return providerName === 'openai' || providerName === 'openrouter';
}

export function getJSONResponseFormatParam(
  providerName: string,
  override?: boolean,
): { response_format: { type: 'json_object' } } | {} {
  const enabled = typeof override === 'boolean'
    ? override
    : supportsJSONResponseFormat(providerName);
  return enabled
    ? { response_format: { type: 'json_object' as const } }
    : {};
}

export async function fetchWithAITimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`${timeoutMs / 1000}s provider timeout`));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function withAITimeout<T>(
  promise: Promise<T>,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${timeoutMs / 1000}s provider timeout`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
