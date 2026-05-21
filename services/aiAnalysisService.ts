/**
 * AI Analysis Service - Phase 4 核心服务
 * 分析 Ontology 设计（Objects/Links/Actions），识别 AI 增强机会
 */
import { AISettings, OntologyObject, OntologyLink, AIPAction, AIIntegrationType, AI_PROVIDERS } from '../types';
import { extractJSON } from '../lib/jsonUtils';
import { requireProviderApiKey } from '../lib/apiKeyUtils';
import { fetchWithAITimeout, getJSONResponseFormatParam, withAITimeout } from './ai/request';

// AI 增强建议类型
export type SuggestionCategory =
  | 'smart_property'      // 智能属性：AI 可以派生的属性
  | 'ai_action'           // AI 动作：可以用 AI 增强的操作
  | 'automation'          // 自动化：可以自动执行的流程
  | 'agent_capability';   // Agent 能力：适合 AI Agent 处理的任务

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface AISuggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  targetObjectId?: string;    // 关联的 Object ID
  targetActionName?: string;  // 关联的 Action 名称
  title: string;              // 建议标题
  description: string;        // 详细描述
  rationale: string;          // 推理依据
  implementation: string;     // 实现建议
  estimatedImpact: string;    // 预期效果
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}

export interface AnalysisResult {
  timestamp: string;
  summary: {
    totalSuggestions: number;
    byCategory: Record<SuggestionCategory, number>;
    byPriority: Record<SuggestionPriority, number>;
  };
  suggestions: AISuggestion[];
  insights: string[];         // 整体洞察
}

// 分析 Prompt
const ANALYSIS_PROMPT = (ontologyJson: string, lang: string) => {
  const isEnglish = lang === 'en';

  return `${isEnglish ? 'You are an AI enhancement specialist analyzing an Ontology design.' : '你是一位 AI 增强专家，正在分析 Ontology 设计。\n\n**重要：你的所有输出内容（包括 title、description、rationale、implementation、estimatedImpact、insights）必须全部使用中文。即使输入的 Ontology 数据是英文，你也必须用中文撰写分析和建议。**'}

${isEnglish ? 'Analyze the following Ontology and identify AI enhancement opportunities:' : '分析以下 Ontology，识别 AI 增强机会：'}

${ontologyJson}

${isEnglish ? `
For each Object and Action, evaluate:

1. **Smart Properties** - Properties that could be AI-derived:
   - Sentiment analysis (e.g., customer feedback sentiment)
   - Classification/categorization (e.g., priority, risk level)
   - Prediction (e.g., estimated completion time)
   - Extraction (e.g., key entities from text)
   - Anomaly indicators (e.g., unusual patterns)

2. **AI-Assisted Actions** - Actions that can benefit from AI:
   - Decision support (e.g., approval recommendations)
   - Auto-fill suggestions (e.g., form completion)
   - Validation enhancement (e.g., intelligent checks)
   - Natural language interface (e.g., voice/chat triggers)

3. **Automation Opportunities** - Workflows that can be automated:
   - Routine decisions (e.g., auto-approve low-risk items)
   - Notification triggers (e.g., smart alerts)
   - Status transitions (e.g., auto-close after inactivity)
   - Batch processing (e.g., bulk classification)

4. **Agent Capabilities** - Tasks suitable for AI agents:
   - Multi-step workflows (e.g., end-to-end order processing)
   - Cross-object coordination (e.g., inventory + orders)
   - Exception handling (e.g., anomaly investigation)
   - Report generation (e.g., daily summaries)

Prioritization criteria:
- HIGH: Immediate business value, straightforward implementation
- MEDIUM: Good value, requires some integration work
- LOW: Nice to have, complex implementation

Return JSON:
{
  "suggestions": [
    {
      "category": "smart_property|ai_action|automation|agent_capability",
      "priority": "high|medium|low",
      "targetObjectId": "object ID if applicable",
      "targetActionName": "action name if applicable",
      "title": "Brief title",
      "description": "Detailed description of the enhancement",
      "rationale": "Why this enhancement makes sense",
      "implementation": "How to implement this",
      "estimatedImpact": "Expected business impact"
    }
  ],
  "insights": [
    "Overall insight about AI enhancement potential",
    "Key recommendation"
  ]
}` : `
对每个 Object 和 Action 评估：

1. **智能属性 (Smart Properties)** - 可由 AI 派生的属性：
   - 情感分析（如：客户反馈情绪）
   - 分类/归类（如：优先级、风险等级）
   - 预测（如：预计完成时间）
   - 提取（如：从文本中提取关键实体）
   - 异常指标（如：异常模式标记）

2. **AI 辅助动作 (AI-Assisted Actions)** - 可以用 AI 增强的操作：
   - 决策支持（如：审批建议）
   - 自动填充建议（如：表单补全）
   - 智能验证（如：增强检查）
   - 自然语言接口（如：语音/聊天触发）

3. **自动化机会 (Automation Opportunities)** - 可以自动执行的流程：
   - 常规决策（如：自动审批低风险项）
   - 触发通知（如：智能告警）
   - 状态流转（如：不活跃自动关闭）
   - 批量处理（如：批量分类）

4. **Agent 能力 (Agent Capabilities)** - 适合 AI Agent 处理的任务：
   - 多步骤工作流（如：端到端订单处理）
   - 跨对象协调（如：库存 + 订单联动）
   - 异常处理（如：异常调查）
   - 报告生成（如：日报汇总）

优先级判断标准：
- HIGH（高）：直接业务价值，实现简单
- MEDIUM（中）：有价值，需要一定集成工作
- LOW（低）：锦上添花，实现复杂

返回 JSON：
{
  "suggestions": [
    {
      "category": "smart_property|ai_action|automation|agent_capability",
      "priority": "high|medium|low",
      "targetObjectId": "关联的对象 ID（如适用）",
      "targetActionName": "关联的动作名称（如适用）",
      "title": "简短标题",
      "description": "详细描述该增强",
      "rationale": "为什么这个增强有意义",
      "implementation": "如何实现",
      "estimatedImpact": "预期业务影响"
    }
  ],
  "insights": [
    "关于 AI 增强潜力的整体洞察",
    "核心建议"
  ]
}`}

${isEnglish ? 'Generate 5-10 high-quality suggestions. Focus on practical, implementable enhancements.' : '生成 5-10 条高质量建议。聚焦于实用、可实现的增强。所有字段内容必须使用中文输出。'}`;
};

export class AIAnalysisService {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  updateSettings(settings: AISettings) {
    this.settings = settings;
  }

  private getBaseUrl(): string {
    if (this.settings.provider === 'custom' && this.settings.customBaseUrl) {
      return this.settings.customBaseUrl;
    }
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.provider);
    return provider?.baseUrl || '';
  }


  /**
   * 分析 Ontology 并生成 AI 增强建议
   */
  async analyzeOntology(
    objects: OntologyObject[],
    links: OntologyLink[],
    lang: string = 'cn',
    options?: { signal?: AbortSignal }
  ): Promise<AnalysisResult> {
    // 构建 Ontology 摘要 JSON
    const ontologySummary = {
      objects: objects.map(obj => ({
        id: obj.id,
        name: obj.name,
        description: obj.description,
        properties: (obj.properties || []).map(p => ({
          name: p.name,
          type: p.type,
          isAIDerived: p.isAIDerived
        })),
        actions: (obj.actions || []).map(a => ({
          name: a.name,
          type: a.type,
          description: a.description,
          businessLayer: a.businessLayer,
          governance: a.governance
        })),
        existingAIFeatures: obj.aiFeatures || []
      })),
      links: links.map(l => ({
        source: l.source,
        target: l.target,
        label: l.label,
        isSemantic: l.isSemantic
      }))
    };

    const prompt = ANALYSIS_PROMPT(JSON.stringify(ontologySummary, null, 2), lang);

    try {
      const responseText = await this.callAI(prompt, options?.signal);
      const result = this.parseResponse(responseText);
      return result;
    } catch (error) {
      console.error('AI 分析失败:', error);
      throw error;
    }
  }

  private async callAI(prompt: string, signal?: AbortSignal): Promise<string> {
    switch (this.settings.provider) {
      case 'gemini':
        return await this.callGemini(prompt, signal);
      default:
        return await this.callOpenAICompatible(prompt, signal);
    }
  }

  private async callGemini(prompt: string, signal?: AbortSignal): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: requireProviderApiKey(this.settings) });

    const response = await withAITimeout(ai.models.generateContent({
      model: this.settings.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    }), signal);

    return extractJSON(response.text || '{}');
  }

  private async callOpenAICompatible(prompt: string, signal?: AbortSignal): Promise<string> {
    const baseUrl = this.getBaseUrl();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${requireProviderApiKey(this.settings)}`,
    };

    if (this.settings.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Ontology Architect';
    }

    const response = await fetchWithAITimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          { role: 'system', content: 'You are an AI enhancement specialist. Output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        ...getJSONResponseFormatParam(this.settings.provider, this.settings.supportsJsonResponseFormat),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 调用失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return extractJSON(data.choices[0]?.message?.content || '{}');
  }

  private parseResponse(responseText: string): AnalysisResult {
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('JSON 解析失败:', responseText);
      parsed = { suggestions: [], insights: [] };
    }

    const suggestions: AISuggestion[] = (parsed.suggestions || []).map((s: any, index: number) => ({
      id: `suggestion-${Date.now()}-${index}`,
      category: s.category || 'smart_property',
      priority: s.priority || 'medium',
      targetObjectId: s.targetObjectId,
      targetActionName: s.targetActionName,
      title: s.title || '未命名建议',
      description: s.description || '',
      rationale: s.rationale || '',
      implementation: s.implementation || '',
      estimatedImpact: s.estimatedImpact || '',
      status: 'pending' as const
    }));

    // 统计
    const byCategory: Record<SuggestionCategory, number> = {
      smart_property: 0,
      ai_action: 0,
      automation: 0,
      agent_capability: 0
    };
    const byPriority: Record<SuggestionPriority, number> = {
      high: 0,
      medium: 0,
      low: 0
    };

    suggestions.forEach(s => {
      byCategory[s.category]++;
      byPriority[s.priority]++;
    });

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuggestions: suggestions.length,
        byCategory,
        byPriority
      },
      suggestions,
      insights: parsed.insights || []
    };
  }
}

/**
 * 将 AI 建议应用到 Ontology
 * 返回更新后的 objects 数组
 */
export function applySuggestionToOntology(
  suggestion: AISuggestion,
  objects: OntologyObject[]
): OntologyObject[] {
  const updatedObjects = [...objects];

  switch (suggestion.category) {
    case 'smart_property': {
      // 添加 AI 派生属性到目标 Object
      if (suggestion.targetObjectId) {
        const objIndex = updatedObjects.findIndex(o => o.id === suggestion.targetObjectId);
        if (objIndex >= 0) {
          const obj = { ...updatedObjects[objIndex] };
          // 从 title 提取属性名（简化处理）
          const propName = suggestion.title
            .replace(/智能属性[:：]?\s*/i, '')
            .replace(/Smart Property[:：]?\s*/i, '')
            .replace(/\s+/g, '_')
            .toLowerCase();

          // 检查是否已存在
          if (!obj.properties.some(p => p.name === propName)) {
            obj.properties = [
              ...obj.properties,
              {
                name: propName,
                type: 'string',
                isAIDerived: true,
                logicDescription: suggestion.implementation || suggestion.description
              }
            ];
          }

          // 添加 AI Feature
          if (!(obj.aiFeatures || []).some(f => f.type === AIIntegrationType.SMART_PROPERTY && f.description === suggestion.title)) {
            obj.aiFeatures = [
              ...(obj.aiFeatures || []),
              {
                type: AIIntegrationType.SMART_PROPERTY,
                description: suggestion.title
              }
            ];
          }

          updatedObjects[objIndex] = obj;
        }
      }
      break;
    }

    case 'ai_action': {
      // 将目标 Action 标记为 generative 或添加 AI 特性
      if (suggestion.targetObjectId && suggestion.targetActionName) {
        const objIndex = updatedObjects.findIndex(o => o.id === suggestion.targetObjectId);
        if (objIndex >= 0) {
          const obj = { ...updatedObjects[objIndex] };
          const actions = obj.actions || [];
          const actionIndex = actions.findIndex(a => a.name === suggestion.targetActionName);

          if (actionIndex >= 0) {
            const action = { ...actions[actionIndex] };
            action.type = 'generative';
            action.aiLogic = suggestion.implementation || suggestion.description;
            obj.actions = [...actions];
            obj.actions[actionIndex] = action;
          }

          // 添加 AI Feature
          if (!(obj.aiFeatures || []).some(f => f.type === AIIntegrationType.GENERATIVE_ACTION && f.description.includes(suggestion.targetActionName || ''))) {
            obj.aiFeatures = [
              ...(obj.aiFeatures || []),
              {
                type: AIIntegrationType.GENERATIVE_ACTION,
                description: `${suggestion.targetActionName}: ${suggestion.title}`
              }
            ];
          }

          updatedObjects[objIndex] = obj;
        }
      }
      break;
    }

    case 'automation': {
      // 更新 Action 的 governance 配置
      if (suggestion.targetObjectId && suggestion.targetActionName) {
        const objIndex = updatedObjects.findIndex(o => o.id === suggestion.targetObjectId);
        if (objIndex >= 0) {
          const obj = { ...updatedObjects[objIndex] };
          const actionIndex = obj.actions.findIndex(a => a.name === suggestion.targetActionName);

          if (actionIndex >= 0) {
            const action = { ...obj.actions[actionIndex] };
            // 自动化建议通常意味着可以降低人工审批要求
            action.governance = {
              ...action.governance,
              permissionTier: 1, // 自动化 = 全自动
              requiresHumanApproval: false,
              auditLog: true,
              riskLevel: 'low'
            };
            obj.actions = [...obj.actions];
            obj.actions[actionIndex] = action;
          }

          updatedObjects[objIndex] = obj;
        }
      }
      break;
    }

    case 'agent_capability': {
      // 添加 Agent 能力到目标 Object 的 aiFeatures
      if (suggestion.targetObjectId) {
        const objIndex = updatedObjects.findIndex(o => o.id === suggestion.targetObjectId);
        if (objIndex >= 0) {
          const obj = { ...updatedObjects[objIndex] };

          // 添加 Semantic Search 或 Parsing Pipeline 能力
          const featureType = suggestion.title.toLowerCase().includes('search') || suggestion.title.toLowerCase().includes('搜索')
            ? AIIntegrationType.SEMANTIC_SEARCH
            : AIIntegrationType.PARSING;

          if (!(obj.aiFeatures || []).some(f => f.description === suggestion.title)) {
            obj.aiFeatures = [
              ...(obj.aiFeatures || []),
              {
                type: featureType,
                description: suggestion.title
              }
            ];
          }

          updatedObjects[objIndex] = obj;
        }
      }
      break;
    }
  }

  return updatedObjects;
}
