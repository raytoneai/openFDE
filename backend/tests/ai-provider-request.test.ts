import { describe, expect, it } from 'vitest';
import { getJSONResponseFormatParam, supportsJSONResponseFormat } from '../src/modules/ai/providers/request.js';

describe('AI provider request helpers', () => {
  it('only sends response_format to known-compatible providers', () => {
    expect(supportsJSONResponseFormat('openai')).toBe(true);
    expect(supportsJSONResponseFormat('openrouter')).toBe(true);
    expect(supportsJSONResponseFormat('moonshot')).toBe(false);
    expect(supportsJSONResponseFormat('zhipu')).toBe(false);
    expect(supportsJSONResponseFormat('custom')).toBe(false);
  });

  it('omits response_format for providers that should rely on prompt-only JSON', () => {
    expect(getJSONResponseFormatParam('moonshot')).toEqual({});
    expect(getJSONResponseFormatParam('zhipu')).toEqual({});
  });
});
