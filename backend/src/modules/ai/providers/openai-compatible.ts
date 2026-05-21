import { logger } from '../../../utils/logger.js';
import type { AIProviderAdapter, ChatMessage, ChatOptions, ModelInfo } from './types.js';
import { SYSTEM_INSTRUCTION, buildDesignPrompt, buildLanguageHint } from './prompts.js';
import { fetchWithProviderTimeout, getJSONResponseFormatParam } from './request.js';

interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  providerName: string;
  /** Extra headers to include (e.g. OpenRouter HTTP-Referer). */
  extraHeaders?: Record<string, string>;
}

/** Adapter for OpenAI-compatible APIs: OpenAI, OpenRouter, Moonshot, Zhipu, Custom. */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async chat(model: string, messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const systemHint = buildLanguageHint(options?.lang);
    const body = {
      model,
      messages: [
        { role: 'system' as const, content: SYSTEM_INSTRUCTION + systemHint },
        ...messages,
      ],
      temperature: options?.temperature ?? 0.7,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    const data = await this.callOpenAI(body);
    return data.choices?.[0]?.message?.content ?? '';
  }

  async design(model: string, chatHistory: ChatMessage[], options?: ChatOptions): Promise<string> {
    const historyText = chatHistory
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n');

    const langHint = buildLanguageHint(options?.lang, true);
    const body = {
      model,
      messages: [
        { role: 'system' as const, content: SYSTEM_INSTRUCTION + langHint },
        { role: 'user' as const, content: buildDesignPrompt(historyText) },
      ],
      temperature: options?.temperature ?? 0.3,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...getJSONResponseFormatParam(this.config.providerName),
    };

    const data = await this.callOpenAI(body);
    return data.choices?.[0]?.message?.content ?? '';
  }

  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseUrl}/models`;
    const res = await fetchWithProviderTimeout(url, {
      headers: this.buildHeaders(),
    });

    if (!res.ok) {
      logger.warn({ provider: this.config.providerName, status: res.status }, 'Failed to list models');
      return [];
    }

    const data = await res.json() as { data?: Array<{ id: string; name?: string }> };
    return (data.data ?? []).map(m => ({
      id: m.id,
      name: m.name || m.id,
    }));
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.extraHeaders,
    };
  }

  private async callOpenAI(body: Record<string, unknown>): Promise<Record<string, any>> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const res = await fetchWithProviderTimeout(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ provider: this.config.providerName, status: res.status, body: text }, 'Provider API error');
      throw new Error(`${this.config.providerName} API error (${res.status}): ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<Record<string, any>>;
  }
}
