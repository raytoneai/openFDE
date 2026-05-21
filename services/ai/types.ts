/** File attachment interface for multimodal chat */
export interface FileAttachment {
  name: string;
  content: string;      // Text content or base64 for binary
  mimeType: string;
  isBase64: boolean;
  extractedText?: string; // Client-side extracted text for Office docs (fallback)
}

export type ModelSource = 'hardcoded' | 'api';

export interface EnrichedModelInfo {
  id: string;
  name: string;
  description?: string;
  source?: ModelSource;
  inputModalities?: string[];
  contextLength?: number;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  promptPrice?: number;
  completionPrice?: number;
}

/** Options for AI service methods that accept a language preference. */
export interface AICallOptions {
  /** User's preferred language code (e.g., 'cn', 'en', 'fr'). Appended to system prompt. */
  lang?: string;
  /** Optional caller-owned cancellation signal. */
  signal?: AbortSignal;
}
