import { describe, expect, it } from 'vitest';
import { getJSONResponseFormatParam, supportsJSONResponseFormat } from '../services/ai/request';

describe('AI request helpers', () => {
  it('only enables JSON response_format for providers known to support it', () => {
    expect(supportsJSONResponseFormat('openai')).toBe(true);
    expect(supportsJSONResponseFormat('openrouter')).toBe(true);
    expect(supportsJSONResponseFormat('gemini')).toBe(false);
    expect(supportsJSONResponseFormat('zhipu')).toBe(false);
    expect(supportsJSONResponseFormat('moonshot')).toBe(false);
    expect(supportsJSONResponseFormat('custom')).toBe(false);
  });

  it('omits response_format for prompt-only JSON providers', () => {
    expect(getJSONResponseFormatParam('moonshot')).toEqual({});
    expect(getJSONResponseFormatParam('zhipu')).toEqual({});
  });
});
