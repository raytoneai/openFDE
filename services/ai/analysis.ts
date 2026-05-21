/**
 * AI Analysis — Extracted analysis & extraction methods.
 *
 * These were originally methods on AIService. They now accept an
 * AIService instance (which exposes `callForJSON`) as their first argument.
 */

import type { ChatMessage } from '../../types';
import type { AIService } from '../aiService';
import type { AICallOptions } from './types';
import { isAbortLikeError } from './request';

// ─── Return types ──────────────────────────────────────────────

export interface ReadinessResult {
  ready: boolean;
  missing: string[];
  identified: { objects: string[]; actions: string[] };
  suggestion: string;
}

export interface CaseRecommendation {
  industry: string | null;
  keywords: string[];
  recommendedCaseIds: string[];
  confidence: number;
}

export interface NounsVerbsResult {
  nouns: Array<{ name: string; description: string; confidence: number }>;
  verbs: Array<{ name: string; targetObject?: string; description: string; confidence: number }>;
}

export interface OntologyElementsResult {
  objects: Array<{ name: string; description: string; confidence: number }>;
  links: Array<{ source: string; target: string; label: string; confidence: number }>;
  actions: Array<{ name: string; targetObject?: string; description: string; confidence: number }>;
}

function shouldRethrowControlError(error: unknown): boolean {
  return isAbortLikeError(error) ||
    (error instanceof Error && error.message.toLowerCase().includes('timed out'));
}

// ─── Standalone functions ──────────────────────────────────────

export async function validateReadiness(
  service: AIService,
  chatHistory: ChatMessage[],
  options?: AICallOptions,
): Promise<ReadinessResult> {
  const historyText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const validationPrompt = `分析以下对话，判断是否有足够信息设计Ontology。\n\n对话历史：\n${historyText}\n\n最低要求（必须同时满足）：\n1. 至少识别出1个明确的业务对象（Object/名词），如：订单、客户、工单\n2. 至少识别出1个明确的业务动作（Action/动词），如：创建、审批、分配\n3. 有基本的业务场景描述\n\n请严格按以下JSON格式回复，不要输出其他内容：\n{"ready": true或false, "identified": {"objects": ["已识别的对象列表"], "actions": ["已识别的动作列表"]}, "missing": ["缺失的信息项"], "suggestion": "一句话建议"}`;

  try {
    const content = await service.callForJSON(validationPrompt, 500, options);
    const parsed = JSON.parse(content);
    return {
      ready: parsed.ready ?? false,
      identified: { objects: parsed.identified?.objects || [], actions: parsed.identified?.actions || [] },
      missing: parsed.missing || [],
      suggestion: parsed.suggestion || '',
    };
  } catch (error) {
    if (shouldRethrowControlError(error)) throw error;
    console.error('验证失败:', error);
    const userMessages = chatHistory.filter(m => m.role === 'user');
    const totalLength = userMessages.reduce((sum, m) => sum + m.content.length, 0);
    if (userMessages.length >= 3 && totalLength > 200) {
      return { ready: true, identified: { objects: [], actions: [] }, missing: ['AI 验证服务暂时不可用'], suggestion: '验证服务暂时不可用，根据对话长度判断可以尝试生成，但结果质量可能受影响。建议稍后重试以获得更准确的验证。' };
    }
    return { ready: false, identified: { objects: [], actions: [] }, missing: ['AI 验证服务暂时不可用', '需要更多对话内容'], suggestion: '请描述更多业务细节，包括涉及的业务对象、流程和操作。至少需要3轮对话和200字以上的内容。' };
  }
}

export async function recommendCases(
  service: AIService,
  chatHistory: ChatMessage[],
  options?: AICallOptions,
): Promise<CaseRecommendation> {
  if (chatHistory.length === 0) return { industry: null, keywords: [], recommendedCaseIds: [], confidence: 0 };
  const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
  const analysisPrompt = `分析以下对话，识别用户的业务场景，用于推荐相关案例。\n\n对话历史：\n${historyText}\n\n请分析并返回JSON：\n{"industry": "识别的行业（manufacturing/retail/logistics/healthcare/finance/energy/agriculture 或 null）", "keywords": ["关键业务词汇"], "scenarioType": "场景类型", "confidence": 0.0-1.0}\n\n行业判断依据：\n- manufacturing: 生产、制造、工厂、产线、设备、工单、BOM、MES\n- retail: 零售、门店、库存、补货、商品、SKU、POS、促销\n- logistics: 物流、配送、路线、车辆、司机、运输、仓储、快递\n- healthcare: 医疗、医院、患者、诊断、处方、病历\n- finance: 金融、银行、贷款、风控、交易、支付\n- energy: 能源、电力、电网、发电、新能源\n- agriculture: 农业、种植、养殖、农产品\n\n如果无法确定行业，industry设为null。`;

  try {
    const content = await service.callForJSON(analysisPrompt, 500, options);
    const analysis = JSON.parse(content);
    const recommendedCaseIds: string[] = [];
    if (analysis.industry === 'manufacturing') recommendedCaseIds.push('manufacturing-production');
    else if (analysis.industry === 'retail') recommendedCaseIds.push('retail-inventory');
    else if (analysis.industry === 'logistics') recommendedCaseIds.push('logistics-delivery');
    const keywords = analysis.keywords || [];
    const keywordLower = keywords.map((k: string) => k.toLowerCase());
    if (keywordLower.some((k: string) => k.includes('生产') || k.includes('制造') || k.includes('production') || k.includes('工单')) && !recommendedCaseIds.includes('manufacturing-production')) recommendedCaseIds.push('manufacturing-production');
    if (keywordLower.some((k: string) => k.includes('库存') || k.includes('补货') || k.includes('inventory') || k.includes('商品')) && !recommendedCaseIds.includes('retail-inventory')) recommendedCaseIds.push('retail-inventory');
    if (keywordLower.some((k: string) => k.includes('配送') || k.includes('物流') || k.includes('delivery') || k.includes('路线')) && !recommendedCaseIds.includes('logistics-delivery')) recommendedCaseIds.push('logistics-delivery');
    return { industry: analysis.industry, keywords: analysis.keywords || [], recommendedCaseIds, confidence: analysis.confidence || 0 };
  } catch (error) {
    if (shouldRethrowControlError(error)) throw error;
    console.error('案例推荐失败:', error);
    return { industry: null, keywords: [], recommendedCaseIds: [], confidence: 0 };
  }
}

export async function extractNounsVerbs(
  service: AIService,
  text: string,
  options?: AICallOptions,
): Promise<NounsVerbsResult> {
  const extractionPrompt = `从以下业务描述中提取核心的业务对象（名词/Nouns）和业务动作（动词/Verbs）。\n\n业务描述：\n${text}\n\n提取规则：\n1. 名词（Objects）：业务实体，如订单、客户、产品、工单、库存等\n   - 忽略泛指词汇\n   - 保留具体业务实体\n2. 动词（Actions）：对对象执行的操作，如创建、审批、发货、分配等\n   - 如果能判断动作的目标对象，请标注\n   - 忽略描述性动词\n3. confidence: 0-1\n\n请严格按以下JSON格式回复：\n{"nouns": [{"name": "对象名称", "description": "简短描述", "confidence": 0.9}], "verbs": [{"name": "动作名称", "targetObject": "目标对象", "description": "简短描述", "confidence": 0.85}]}`;

  try {
    const content = await service.callForJSON(extractionPrompt, 1000, options);
    return JSON.parse(content);
  } catch (error) {
    if (shouldRethrowControlError(error)) throw error;
    console.error('Noun/Verb提取失败:', error);
    return { nouns: [], verbs: [] };
  }
}

export async function extractOntologyElements(
  service: AIService,
  text: string,
  options?: AICallOptions,
): Promise<OntologyElementsResult> {
  const extractionPrompt = `从以下业务描述中提取 Ontology 的三个核心要素：Objects（对象）、Links（关系）、Actions（动作）。\n\n业务描述：\n${text}\n\n提取规则：\n\n1. Objects（业务对象/名词）：识别具体的业务实体\n2. Links（对象间关系）：识别对象之间的关联关系\n3. Actions（业务动作/动词）：识别对对象执行的操作\n4. confidence: 0-1\n\n请严格按以下JSON格式回复：\n{"objects": [{"name": "对象名称", "description": "简短描述", "confidence": 0.9}], "links": [{"source": "源对象名", "target": "目标对象名", "label": "关系标签", "confidence": 0.8}], "actions": [{"name": "动作名称", "targetObject": "目标对象", "description": "简短描述", "confidence": 0.85}]}`;

  try {
    const content = await service.callForJSON(extractionPrompt, 1500, options);
    const result = JSON.parse(content);
    return { objects: result.objects || [], links: result.links || [], actions: result.actions || result.verbs || [] };
  } catch (error) {
    if (shouldRethrowControlError(error)) throw error;
    console.error('Ontology要素提取失败:', error);
    return { objects: [], links: [], actions: [] };
  }
}
