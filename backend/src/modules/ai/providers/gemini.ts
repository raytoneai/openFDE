import { GoogleGenAI } from '@google/genai';
import { logger } from '../../../utils/logger.js';
import type { AIProviderAdapter, ChatMessage, ChatOptions, ModelInfo } from './types.js';
import { SYSTEM_INSTRUCTION, buildDesignPrompt, buildLanguageHint } from './prompts.js';
import { withProviderTimeout } from './request.js';

export class GeminiAdapter implements AIProviderAdapter {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async chat(model: string, messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const systemHint = buildLanguageHint(options?.lang);
    const systemInstruction = SYSTEM_INSTRUCTION + systemHint;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    const response = await withProviderTimeout(this.client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: options?.temperature ?? 0.7,
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      },
    }));

    return response.text ?? '';
  }

  async design(model: string, chatHistory: ChatMessage[], options?: ChatOptions): Promise<string> {
    const historyText = chatHistory
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n');

    const langHint = buildLanguageHint(options?.lang, true);
    const systemInstruction = SYSTEM_INSTRUCTION + langHint;

    const response = await withProviderTimeout(this.client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: buildDesignPrompt(historyText) }] }],
      config: {
        systemInstruction,
        temperature: options?.temperature ?? 0.3,
        responseMimeType: 'application/json',
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      },
    }));

    return response.text ?? '';
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const pager = await this.client.models.list();
      const models: ModelInfo[] = [];
      for await (const m of pager) {
        if (m.name) {
          const id = m.name.replace(/^models\//, '');
          models.push({
            id,
            name: m.displayName || id,
            description: m.description,
          });
        }
      }
      return models;
    } catch (err) {
      logger.warn({ err }, 'Failed to list Gemini models');
      return [];
    }
  }
}
