/**
 * Thin client that delegates AI calls to the backend proxy (/api/ai/*).
 * Uses the authenticated apiClient for all requests.
 */

import { apiClient } from '../apiClient';
import type { EnrichedModelInfo, AICallOptions } from './types';
import type { ChatMessage, AISettings } from '../../types';
import { AI_REQUEST_TIMEOUT_MS } from './request';

interface ChatResponse {
  content: string;
}

interface ModelsResponse {
  models: Array<{ id: string; name: string; description?: string }>;
}

export async function proxyChat(
  settings: AISettings,
  history: ChatMessage[],
  nextMessage: string,
  options?: AICallOptions,
): Promise<string> {
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: nextMessage },
  ];
  const resp = await apiClient.post<ChatResponse>('/ai/chat', {
    provider: settings.provider,
    model: settings.model,
    messages,
    options: options ? { lang: options.lang } : undefined,
  }, {
    signal: options?.signal,
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
  return resp.content;
}

export async function proxyChatWithFiles(
  settings: AISettings,
  history: ChatMessage[],
  nextMessage: string,
  files: Array<{ name: string; content: string; mimeType?: string; isBase64: boolean; extractedText?: string }>,
  options?: AICallOptions,
): Promise<string> {
  // Append file content to the message:
  // 1. Text files → inline content
  // 2. Binary files with extractedText → use extracted text
  // 3. Binary images → base64 data URI (backend can forward to vision models)
  // 4. Other binary without extractedText → warn user
  let enhancedMessage = nextMessage;
  const imageAttachments: Array<{ name: string; dataUri: string }> = [];

  for (const file of files) {
    if (!file.isBase64) {
      // Plain text file
      enhancedMessage += `\n\n--- Attachment: ${file.name} ---\n${file.content}\n--- End ---`;
    } else if (file.extractedText) {
      // Binary file with extracted text (Office docs, etc.)
      enhancedMessage += `\n\n--- Attachment: ${file.name} (extracted text) ---\n${file.extractedText}\n--- End ---`;
    } else if (file.mimeType?.startsWith('image/')) {
      // Image → include as base64 data URI for vision model support
      enhancedMessage += `\n\n[Image attached: ${file.name}]`;
      imageAttachments.push({
        name: file.name,
        dataUri: `data:${file.mimeType};base64,${file.content}`,
      });
    } else {
      // Binary file without extraction — notify user
      enhancedMessage += `\n\n[Attachment: ${file.name} — binary file could not be processed in proxy mode. For full file support, use direct AI connection mode.]`;
    }
  }

  // If we have image attachments, include them in the message for the backend to forward
  if (imageAttachments.length > 0) {
    enhancedMessage += `\n\n<!-- IMAGE_ATTACHMENTS: ${JSON.stringify(imageAttachments.map(a => a.name))} -->`;
  }

  return proxyChat(settings, history, enhancedMessage, options);
}

export async function proxyDesign(
  settings: AISettings,
  chatHistory: ChatMessage[],
  options?: AICallOptions,
): Promise<string> {
  const resp = await apiClient.post<ChatResponse>('/ai/design', {
    provider: settings.provider,
    model: settings.model,
    chatHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
    options: options ? { lang: options.lang } : undefined,
  }, {
    signal: options?.signal,
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
  return resp.content;
}

export async function proxyListModels(
  settings: AISettings,
): Promise<EnrichedModelInfo[]> {
  const resp = await apiClient.get<ModelsResponse>(
    `/ai/models?provider=${encodeURIComponent(settings.provider)}`,
  );
  return (resp.models || []).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    source: 'api' as const,
  }));
}
