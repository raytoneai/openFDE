/**
 * AI Service — Multi-provider abstraction for Ontology Architect.
 *
 * This file is the public API barrel. Internal logic is split across:
 *   - ai/types.ts      — Shared interfaces (FileAttachment, EnrichedModelInfo, etc.)
 *   - ai/prompts.ts    — System prompts + language hint builder
 *   - ai/settings.ts   — Settings persistence (load/save/clear)
 *   - ai/analysis.ts   — Analysis & extraction standalone functions
 */

import { AISettings, ChatMessage, AI_PROVIDERS } from '../types';
import { extractJSON } from '../lib/jsonUtils';
import { getProviderApiKey, requireProviderApiKey } from '../lib/apiKeyUtils';

// Re-export public types & settings so existing importers don't break
export type { FileAttachment, EnrichedModelInfo, AICallOptions, ModelSource } from './ai/types';
export { loadAISettings, loadAISettingsAsync, saveAISettings, clearAISettings, DEFAULT_AI_SETTINGS } from './ai/settings';

// Re-export analysis types & functions for backward compatibility
export type { ReadinessResult, CaseRecommendation, NounsVerbsResult, OntologyElementsResult } from './ai/analysis';
export { validateReadiness, recommendCases, extractNounsVerbs, extractOntologyElements } from './ai/analysis';

import type { FileAttachment, EnrichedModelInfo, AICallOptions } from './ai/types';
import { SYSTEM_INSTRUCTION, DESIGN_PROMPT_TEMPLATE, buildLanguageHint } from './ai/prompts';
import { type AIMode, getAIMode, isForceProxy } from './ai/mode';
import { proxyChat, proxyChatWithFiles, proxyDesign, proxyListModels } from './ai/proxyClient';
import { fetchWithAITimeout, getJSONResponseFormatParam, withAITimeout } from './ai/request';
import { apiClient } from './apiClient';
import {
  validateReadiness as _validateReadiness,
  recommendCases as _recommendCases,
  extractNounsVerbs as _extractNounsVerbs,
  extractOntologyElements as _extractOntologyElements,
} from './ai/analysis';

// ─── Gemini SDK cache (shared across instances for perf) ────────
let cachedGoogleGenAI: typeof import('@google/genai').GoogleGenAI | null = null;
let cachedGeminiInstance: InstanceType<typeof import('@google/genai').GoogleGenAI> | null = null;
let cachedGeminiApiKey: string | null = null;

export class AIService {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  updateSettings(settings: AISettings) {
    const previousKey = getProviderApiKey(this.settings);
    this.settings = settings;
    if (this.settings.provider === 'gemini' && cachedGeminiApiKey !== getProviderApiKey(this.settings)) {
      cachedGeminiInstance = null;
      cachedGeminiApiKey = null;
    }
    if (settings.provider !== 'gemini' && previousKey !== getProviderApiKey(this.settings)) {
      cachedGeminiInstance = null;
      cachedGeminiApiKey = null;
    }
  }

  // ─── Provider call helpers ──────────────────────────────────

  /**
   * Resolve effective AI mode: proxy requires authentication,
   * otherwise fall back to direct to avoid 401 errors.
   */
  private async getEffectiveMode(): Promise<AIMode> {
    const mode = await getAIMode();
    if (mode === 'proxy' && (!apiClient.isAuthenticated() || apiClient.isTokenExpired())) {
      return 'direct';
    }
    return mode;
  }

  private getBaseUrl(): string {
    if (this.settings.provider === 'custom' && this.settings.customBaseUrl) {
      const url = this.settings.customBaseUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('Invalid customBaseUrl: must start with http:// or https://');
      }
      try { new URL(url); } catch { throw new Error('Invalid customBaseUrl: not a valid URL'); }
      return url.replace(/\/+$/, '');
    }
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.provider);
    const baseUrl = provider?.baseUrl;
    if (!baseUrl) throw new Error(`No base URL configured for provider: ${this.settings.provider}`);
    return baseUrl;
  }

  private async getGeminiClient() {
    if (!cachedGoogleGenAI) {
      const module = await import('@google/genai');
      cachedGoogleGenAI = module.GoogleGenAI;
    }
    if (!cachedGeminiInstance || cachedGeminiApiKey !== getProviderApiKey(this.settings)) {
      const apiKey = requireProviderApiKey(this.settings);
      cachedGeminiInstance = new cachedGoogleGenAI({ apiKey });
      cachedGeminiApiKey = apiKey;
    }
    return cachedGeminiInstance;
  }

  private buildOpenAIHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${requireProviderApiKey(this.settings)}`,
    };
    if (this.settings.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Ontology Architect';
    }
    return headers;
  }

  private async callGemini(messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
    const ai = await this.getGeminiClient();
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
    const response = await withAITimeout(ai.models.generateContent({
      model: this.settings.model,
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION }] },
        { role: 'model', parts: [{ text: '我理解了，我将作为 Ontology 架构师，遵循方法论原则来帮助你设计系统。' }] },
        ...contents,
      ],
    }), signal);
    return response.text || '';
  }

  private async callOpenAICompatible(messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
    const baseUrl = this.getBaseUrl();
    let response: Response;
    try {
      response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildOpenAIHeaders(),
        signal,
        body: JSON.stringify({
          model: this.settings.model,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
    } catch (fetchError) {
      throw new Error(`无法连接到 ${baseUrl}（网络错误）。请检查：1) 网络连接是否正常；2) 是否需要代理/VPN 访问该服务；3) 浏览器控制台是否有 CORS 错误。`);
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API调用失败: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callZhipu(messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
    const baseUrl = this.getBaseUrl();
    let response: Response;
    try {
      response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` },
        signal,
        body: JSON.stringify({
          model: this.settings.model,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
    } catch (fetchError) {
      throw new Error(`无法连接到 ${baseUrl}（网络错误）。请检查网络连接或代理设置。`);
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`智谱API调用失败: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  // ─── Public chat methods ────────────────────────────────────

  async chat(history: ChatMessage[], nextMessage: string, options?: AICallOptions): Promise<string> {
    const mode = await this.getEffectiveMode();
    if (mode === 'proxy') {
      return proxyChat(this.settings, history, nextMessage, options);
    }
    if (isForceProxy()) {
      throw new Error('Backend AI proxy is required (VITE_FORCE_PROXY=true) but not available.');
    }
    const langHint = buildLanguageHint(options?.lang);
    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: nextMessage + langHint },
    ];
    try {
      switch (this.settings.provider) {
        case 'gemini': return await this.callGemini(messages, options?.signal);
        case 'zhipu': return await this.callZhipu(messages, options?.signal);
        default: return await this.callOpenAICompatible(messages, options?.signal);
      }
    } catch (error) {
      console.error('AI调用失败:', error);
      throw error;
    }
  }

  async chatWithFiles(history: ChatMessage[], nextMessage: string, files: FileAttachment[], options?: AICallOptions): Promise<string> {
    const mode = await this.getEffectiveMode();
    if (mode === 'proxy') {
      return proxyChatWithFiles(this.settings, history, nextMessage, files, options);
    }
    if (isForceProxy()) {
      throw new Error('Backend AI proxy is required (VITE_FORCE_PROXY=true) but not available.');
    }
    const hasMultimodalFiles = files.some(f => f.isBase64);
    if (!hasMultimodalFiles) {
      let enhancedMessage = nextMessage;
      for (const file of files) {
        enhancedMessage += `\n\n--- 附件: ${file.name} ---\n${file.content}\n--- 附件结束 ---`;
      }
      return this.chat(history, enhancedMessage, options);
    }
    try {
      switch (this.settings.provider) {
        case 'gemini': return await this.callGeminiMultimodal(history, nextMessage, files, options?.lang, options?.signal);
        case 'zhipu': return await this.callZhipuMultimodal(history, nextMessage, files, options?.lang, options?.signal);
        default: return await this.callOpenAIMultimodal(history, nextMessage, files, options?.lang, options?.signal);
      }
    } catch (error) {
      console.error('多模态AI调用失败:', error);
      throw error;
    }
  }

  // ─── Multimodal helpers ─────────────────────────────────────

  private isOfficeMimeType(mimeType: string): boolean {
    return mimeType.includes('wordprocessingml') || mimeType.includes('spreadsheetml') ||
      mimeType.includes('presentationml') || mimeType.includes('msword') ||
      mimeType.includes('excel') || mimeType.includes('powerpoint');
  }

  private async callGeminiMultimodal(history: ChatMessage[], nextMessage: string, files: FileAttachment[], lang?: string, signal?: AbortSignal): Promise<string> {
    const ai = await this.getGeminiClient();
    const parts: any[] = [];
    if (nextMessage) parts.push({ text: nextMessage });

    for (const file of files) {
      if (file.isBase64) {
        if (this.isOfficeMimeType(file.mimeType)) {
          try {
            const binaryStr = atob(file.content);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const blob = new Blob([bytes], { type: file.mimeType });
            const uploaded = await ai.files.upload({ file: blob, config: { mimeType: file.mimeType } });
            if (uploaded.uri) {
              parts.push({ fileData: { fileUri: uploaded.uri, mimeType: file.mimeType } });
            } else {
              throw new Error('File API returned no URI');
            }
          } catch (err) {
            console.warn('Gemini File API upload failed, falling back to extractedText:', err);
            if (file.extractedText) {
              parts.push({ text: `\n--- 附件: ${file.name} (文本提取) ---\n${file.extractedText}\n--- 附件结束 ---` });
            } else {
              parts.push({ text: `[附件: ${file.name}] - 文件上传失败，且无法提取文本内容。` });
            }
          }
        } else {
          parts.push({ inlineData: { mimeType: file.mimeType, data: file.content } });
        }
      } else {
        parts.push({ text: `\n--- 附件: ${file.name} ---\n${file.content}\n--- 附件结束 ---` });
      }
    }

    const response = await withAITimeout(ai.models.generateContent({
      model: this.settings.model,
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION + buildLanguageHint(lang) }] },
        { role: 'model', parts: [{ text: '我理解了，我将作为 Ontology 架构师，遵循方法论原则来帮助你设计系统。' }] },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        { role: 'user', parts },
      ],
    }), signal);
    return response.text || '';
  }

  private async callOpenAIMultimodal(history: ChatMessage[], nextMessage: string, files: FileAttachment[], lang?: string, signal?: AbortSignal): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const isOpenRouter = this.settings.provider === 'openrouter';
    const isOpenAI = this.settings.provider === 'openai';
    const supportsNativeFile = isOpenRouter || isOpenAI;
    const content: any[] = [];
    if (nextMessage) content.push({ type: 'text', text: nextMessage });

    for (const file of files) {
      if (file.isBase64) {
        const isOffice = this.isOfficeMimeType(file.mimeType);
        const isPdf = file.mimeType === 'application/pdf';
        if (file.mimeType.startsWith('image/')) {
          content.push({ type: 'image_url', image_url: { url: `data:${file.mimeType};base64,${file.content}` } });
        } else if (isOffice && file.extractedText) {
          content.push({ type: 'text', text: `\n--- 附件: ${file.name} (文本提取) ---\n${file.extractedText}\n--- 附件结束 ---` });
        } else if (isOffice && isOpenAI) {
          content.push({ type: 'file', file: { filename: file.name, file_data: `data:${file.mimeType};base64,${file.content}` } });
        } else if (isPdf && supportsNativeFile) {
          content.push({ type: 'file', file: { filename: file.name, file_data: `data:${file.mimeType};base64,${file.content}` } });
        } else if (file.extractedText) {
          content.push({ type: 'text', text: `\n--- 附件: ${file.name} (文本提取) ---\n${file.extractedText}\n--- 附件结束 ---` });
        } else {
          content.push({ type: 'text', text: `[附件: ${file.name}] - 当前模型无法直接读取此文件格式，且文本提取不可用。` });
        }
      } else {
        content.push({ type: 'text', text: `\n--- 附件: ${file.name} ---\n${file.content}\n--- 附件结束 ---` });
      }
    }

    const messages: any[] = [
      { role: 'system', content: SYSTEM_INSTRUCTION + buildLanguageHint(lang) },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content },
    ];

    const response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildOpenAIHeaders(),
      signal,
      body: JSON.stringify({ model: this.settings.model, messages, temperature: 0.7, max_tokens: 8192 }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`多模态API调用失败: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callZhipuMultimodal(history: ChatMessage[], nextMessage: string, files: FileAttachment[], lang?: string, signal?: AbortSignal): Promise<string> {
    const content: any[] = [];
    if (nextMessage) content.push({ type: 'text', text: nextMessage });
    for (const file of files) {
      if (file.isBase64 && file.mimeType.startsWith('image/')) {
        content.push({ type: 'image_url', image_url: { url: `data:${file.mimeType};base64,${file.content}` } });
      } else if (file.isBase64 && file.extractedText) {
        content.push({ type: 'text', text: `\n--- 附件: ${file.name} (文本提取) ---\n${file.extractedText}\n--- 附件结束 ---` });
      } else if (file.isBase64) {
        content.push({ type: 'text', text: `[附件: ${file.name}] - 当前模型无法直接读取此文件格式。` });
      } else {
        content.push({ type: 'text', text: `\n--- 附件: ${file.name} ---\n${file.content}\n--- 附件结束 ---` });
      }
    }
    const response = await fetchWithAITimeout(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` },
      signal,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION + buildLanguageHint(lang) },
          ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          { role: 'user', content },
        ],
        temperature: 0.7, max_tokens: 4096,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`智谱多模态API调用失败: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  // ─── Ontology design ────────────────────────────────────────

  async designOntology(chatHistory: ChatMessage[], options?: AICallOptions): Promise<string> {
    const mode = await this.getEffectiveMode();
    if (mode === 'proxy') {
      const raw = await proxyDesign(this.settings, chatHistory, options);
      return extractJSON(raw);
    }
    if (isForceProxy()) {
      throw new Error('Backend AI proxy is required (VITE_FORCE_PROXY=true) but not available.');
    }
    const historyText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = DESIGN_PROMPT_TEMPLATE(historyText) + buildLanguageHint(options?.lang, true);

    try {
      switch (this.settings.provider) {
        case 'gemini': {
          const ai = await this.getGeminiClient();
          const response = await withAITimeout(ai.models.generateContent({
            model: this.settings.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          }), options?.signal);
          return extractJSON(response.text || '{}');
        }
        default: {
          const baseUrl = this.getBaseUrl();
          const response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.buildOpenAIHeaders(),
            signal: options?.signal,
            body: JSON.stringify({
              model: this.settings.model,
              messages: [
                { role: 'system', content: '你是一个JSON生成器，只输出有效的JSON，不要输出其他内容。' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.3, max_tokens: 8192,
              ...getJSONResponseFormatParam(this.settings.provider),
            }),
          });
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`API调用失败: ${response.status} - ${error}`);
          }
          const data = await response.json();
          return extractJSON(data.choices[0]?.message?.content || '{}');
        }
      }
    } catch (error) {
      console.error('Ontology设计生成失败:', error);
      throw error;
    }
  }

  // ─── Connection test ────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.chat([], '你好，请用一句话介绍自己。');
      return { success: true, message: result.slice(0, 100) + '...' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '连接失败' };
    }
  }

  // ─── Model discovery ────────────────────────────────────────

  async fetchAvailableModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    const mode = await this.getEffectiveMode();
    if (mode === 'proxy') {
      return proxyListModels(this.settings);
    }
    if (isForceProxy()) {
      throw new Error('Backend AI proxy is required (VITE_FORCE_PROXY=true) but not available.');
    }
    try {
      switch (this.settings.provider) {
        case 'gemini': return await this.fetchGeminiModels();
        case 'openrouter': return await this.fetchOpenRouterModels(signal);
        case 'openai': return await this.fetchOpenAIModels(signal);
        case 'zhipu': return await this.fetchZhipuModels(signal);
        case 'moonshot': return await this.fetchMoonshotModels(signal);
        case 'custom': return await this.fetchCustomModels(signal);
        default: return [];
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      throw error;
    }
  }

  private async fetchGeminiModels(): Promise<EnrichedModelInfo[]> {
    const ai = await this.getGeminiClient();
    const models: EnrichedModelInfo[] = [];
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const model of pager) {
      if (model.name && model.supportedActions?.includes('generateContent')) {
        const modelId = model.name.replace('models/', '');
        const idLower = modelId.toLowerCase();
        const supportsFile = idLower.includes('gemini-1.5') || idLower.includes('gemini-2');
        models.push({
          id: modelId, name: model.displayName || modelId,
          description: model.description?.slice(0, 50) || undefined, source: 'api',
          inputModalities: supportsFile ? ['text', 'image', 'file'] : ['text', 'image'],
          contextLength: Number((model as any).inputTokenLimit) || undefined,
          supportsTools: true, supportsStructuredOutput: true,
        });
      }
    }
    return models.sort((a, b) => {
      const aScore = a.id.includes('gemini-2') ? 0 : a.id.includes('gemini-1.5') ? 1 : 2;
      const bScore = b.id.includes('gemini-2') ? 0 : b.id.includes('gemini-1.5') ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return a.name.localeCompare(b.name);
    });
  }

  private async fetchOpenRouterModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Ontology Architect' },
      signal,
    });
    if (!response.ok) throw new Error(`获取模型列表失败: ${response.status}`);
    const data = await response.json();
    return (data.data || [])
      .filter((m: any) => m.id && !m.id.includes(':free'))
      .map((m: any) => {
        const inputModalities = Array.isArray(m.architecture?.input_modalities) ? m.architecture.input_modalities : undefined;
        const supported = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
        const promptPrice = Number(m.pricing?.prompt);
        const completionPrice = Number(m.pricing?.completion);
        return {
          id: m.id, name: m.name || m.id,
          description: Number.isFinite(promptPrice) ? `$${(promptPrice * 1000000).toFixed(2)}/M tokens` : undefined,
          source: 'api' as const, inputModalities,
          contextLength: Number(m.context_length) || undefined,
          supportsTools: supported.includes('tools'),
          supportsStructuredOutput: supported.includes('response_format'),
          promptPrice: Number.isFinite(promptPrice) ? promptPrice : undefined,
          completionPrice: Number.isFinite(completionPrice) ? completionPrice : undefined,
        };
      })
      .sort((a: any, b: any) => {
        const providers = ['anthropic', 'openai', 'google', 'meta-llama', 'deepseek', 'qwen'];
        const aIdx = providers.indexOf(a.id.split('/')[0]);
        const bIdx = providers.indexOf(b.id.split('/')[0]);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  private async fetchOpenAIModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` }, signal,
    });
    if (!response.ok) throw new Error(`获取模型列表失败: ${response.status}`);
    const data = await response.json();
    return (data.data || [])
      .filter((m: any) => {
        const id = m.id.toLowerCase();
        return (id.includes('gpt') || id.includes('o1') || id.includes('o3')) &&
          !id.includes('instruct') && !id.includes('realtime') && !id.includes('audio');
      })
      .map((m: any) => {
        const id = String(m.id || '').toLowerCase();
        const isVision = id.includes('4o') || id.includes('vision');
        const isLongContext = id.includes('gpt-4.1') || id.includes('128k');
        const isReasoningOnly = id.startsWith('o1');
        return {
          id: m.id, name: m.id, description: m.owned_by || undefined,
          source: 'api' as const,
          inputModalities: isVision ? ['text', 'image'] : ['text'],
          contextLength: isLongContext ? 1000000 : (id.includes('o3') ? 200000 : undefined),
          supportsTools: !isReasoningOnly, supportsStructuredOutput: !isReasoningOnly,
        };
      })
      .sort((a: any, b: any) => {
        const priority = ['o3', 'o1', 'gpt-4o', 'gpt-4', 'gpt-3.5'];
        for (const p of priority) {
          if (a.id.includes(p) && !b.id.includes(p)) return -1;
          if (!a.id.includes(p) && b.id.includes(p)) return 1;
        }
        return a.id.localeCompare(b.id);
      });
  }

  private async fetchZhipuModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        headers: { 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` }, signal,
      });
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        if (models.length > 0) {
          return models
            .filter((m: any) => m.id && (m.id.includes('glm') || m.id.includes('cogview') || m.id.includes('cog')))
            .map((m: any) => {
              const id = String(m.id || '').toLowerCase();
              return {
                id: m.id, name: m.id, description: m.owned_by || undefined, source: 'api' as const,
                inputModalities: (id.includes('4v') || id.includes('4.6v') || id.includes('cog')) ? ['text', 'image'] : ['text'],
                contextLength: id.includes('long') ? 1000000 : undefined,
                supportsTools: true, supportsStructuredOutput: true,
              };
            })
            .sort((a: any, b: any) => {
              const priority = ['glm-4-plus', 'glm-4.', 'glm-4-', 'glm-4v', 'glm-4', 'glm-3'];
              for (const p of priority) {
                if (a.id.includes(p) && !b.id.includes(p)) return -1;
                if (!a.id.includes(p) && b.id.includes(p)) return 1;
              }
              return a.id.localeCompare(b.id);
            });
        }
      }
    } catch (error) {
      console.log('智谱 API 获取模型列表失败，使用默认列表:', error);
    }
    // Fallback hardcoded list
    return [
      { id: 'glm-4.7', name: 'GLM-4.7', description: '最新旗舰，支持思考模式', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', description: '最新快速版', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.6', name: 'GLM-4.6', description: '高性能对话', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.6-flash', name: 'GLM-4.6 Flash', description: '快速版', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.6v', name: 'GLM-4.6V', description: '多模态', source: 'hardcoded', inputModalities: ['text', 'image'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.6v-flash', name: 'GLM-4.6V Flash', description: '多模态快速', source: 'hardcoded', inputModalities: ['text', 'image'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.5', name: 'GLM-4.5', description: '高性能', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4.5v', name: 'GLM-4.5V', description: '多模态', source: 'hardcoded', inputModalities: ['text', 'image'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '高性能', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-air', name: 'GLM-4 Air', description: '高性价比', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-airx', name: 'GLM-4 AirX', description: '极速推理', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-long', name: 'GLM-4 Long', description: '长文本', source: 'hardcoded', inputModalities: ['text'], contextLength: 1000000, supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', description: '免费快速', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4-flashx', name: 'GLM-4 FlashX', description: '超快免费', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4', name: 'GLM-4', description: '通用对话', source: 'hardcoded', inputModalities: ['text'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4v-plus', name: 'GLM-4V Plus', description: '多模态', source: 'hardcoded', inputModalities: ['text', 'image'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'glm-4v', name: 'GLM-4V', description: '多模态基础', source: 'hardcoded', inputModalities: ['text', 'image'], supportsTools: true, supportsStructuredOutput: true },
      { id: 'cogview-3-plus', name: 'CogView-3 Plus', description: '图像生成', source: 'hardcoded', inputModalities: ['text', 'image'] },
      { id: 'cogview-3', name: 'CogView-3', description: '图像生成', source: 'hardcoded', inputModalities: ['text', 'image'] },
    ];
  }

  private async fetchMoonshotModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        headers: { 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` }, signal,
      });
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        if (models.length > 0) {
          const nameMap: Record<string, { name: string; description: string; priority: number }> = {
            'kimi-k2-0711-preview': { name: 'Kimi K2 Preview (0711)', description: '最新 K2 模型', priority: 0 },
            'kimi-k2-0905-preview': { name: 'Kimi K2 Preview (0905)', description: 'K2 稳定版', priority: 1 },
            'kimi-k2-0905': { name: 'Kimi K2 (0905)', description: 'K2 正式版', priority: 2 },
            'moonshot-v1-auto': { name: 'Moonshot v1 Auto', description: '自动选择上下文', priority: 10 },
            'moonshot-v1-128k': { name: 'Moonshot v1 128K', description: '超长上下文 128K', priority: 11 },
            'moonshot-v1-32k': { name: 'Moonshot v1 32K', description: '长上下文 32K', priority: 12 },
            'moonshot-v1-8k': { name: 'Moonshot v1 8K', description: '标准 8K', priority: 13 },
          };
          return models.map((m: any) => {
            const mapped = nameMap[m.id];
            if (mapped) return { id: m.id, name: mapped.name, description: mapped.description, priority: mapped.priority, source: 'api' as const, inputModalities: ['text'], supportsTools: true };
            const friendlyName = m.id.replace(/^moonshot-/, 'Moonshot ').replace(/^kimi-/, 'Kimi ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            return { id: m.id, name: friendlyName, description: m.owned_by || '新模型', priority: 50, source: 'api' as const, inputModalities: ['text'], supportsTools: true };
          }).sort((a: any, b: any) => (a.priority || 50) - (b.priority || 50));
        }
      }
    } catch { /* Fallback */ }
    return [
      { id: 'kimi-k2-0711-preview', name: 'Kimi K2 Preview', description: '最新 K2 模型（推荐）', source: 'hardcoded', inputModalities: ['text'], supportsTools: true },
      { id: 'moonshot-v1-auto', name: 'Moonshot v1 Auto', description: '自动选择上下文', source: 'hardcoded', inputModalities: ['text'], contextLength: 128000, supportsTools: true },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', description: '超长上下文 128K', source: 'hardcoded', inputModalities: ['text'], contextLength: 128000, supportsTools: true },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', description: '长上下文 32K', source: 'hardcoded', inputModalities: ['text'], contextLength: 32000, supportsTools: true },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', description: '标准 8K', source: 'hardcoded', inputModalities: ['text'], contextLength: 8000, supportsTools: true },
    ];
  }

  private async fetchCustomModels(signal?: AbortSignal): Promise<EnrichedModelInfo[]> {
    if (!this.settings.customBaseUrl) return [{ id: 'custom', name: '自定义模型', description: '请输入模型ID', source: 'hardcoded' }];
    try {
      const response = await fetch(`${this.settings.customBaseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${requireProviderApiKey(this.settings)}` }, signal,
      });
      if (!response.ok) return [{ id: 'custom', name: '自定义模型', description: '请手动输入模型ID', source: 'hardcoded' }];
      const data = await response.json();
      return (data.data || data.models || []).map((m: any) => ({
        id: m.id || m.name, name: m.name || m.id, description: m.description || undefined, source: 'api',
      }));
    } catch {
      return [{ id: 'custom', name: '自定义模型', description: '请手动输入模型ID', source: 'hardcoded' }];
    }
  }

  // ─── JSON helper (used by ai/analysis.ts) ──────────────────

  /** Call provider for JSON output. Public so ai/analysis.ts standalone functions can use it. */
  async callForJSON(prompt: string, maxTokens = 500, options?: AICallOptions): Promise<string> {
    if (this.settings.provider === 'gemini') {
      const ai = await this.getGeminiClient();
      const response = await withAITimeout(ai.models.generateContent({
        model: this.settings.model, contents: prompt,
        config: { responseMimeType: 'application/json' },
      }), options?.signal);
      return response.text || '{}';
    }
    const baseUrl = this.getBaseUrl();
    const response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildOpenAIHeaders(),
      signal: options?.signal,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, max_tokens: maxTokens,
        ...getJSONResponseFormatParam(this.settings.provider),
      }),
    });
    if (!response.ok) throw new Error(`API调用失败: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || '{}';
  }

  // ─── Analysis delegations (backward compat) ────────────────

  validateReadiness(chatHistory: ChatMessage[], options?: AICallOptions) { return _validateReadiness(this, chatHistory, options); }
  recommendCases(chatHistory: ChatMessage[], options?: AICallOptions) { return _recommendCases(this, chatHistory, options); }
  extractNounsVerbs(text: string, options?: AICallOptions) { return _extractNounsVerbs(this, text, options); }
  extractOntologyElements(text: string, options?: AICallOptions) { return _extractOntologyElements(this, text, options); }
}
