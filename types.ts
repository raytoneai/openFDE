
// Tier system
export type { Tier, TierFeatures } from './lib/tiers';

export type Language = 'en' | 'cn' | 'fr' | 'ar' | 'es' | 'ja';

export enum AIPComponentType {
  OBJECT = 'OBJECT',
  LINK = 'LINK',
  ACTION = 'ACTION',
  AI_LOGIC = 'AI_LOGIC'
}

export enum AIIntegrationType {
  PARSING = 'Parsing Pipeline (Unstructured to Structured)',
  SMART_PROPERTY = 'Smart Property (LLM Derived)',
  SEMANTIC_SEARCH = 'Semantic Search (Vector Linking)',
  GENERATIVE_ACTION = 'Generative Action (AI Output)'
}

export interface Property {
  name: string;
  type: string;
  description?: string;       // Property description for documentation
  required?: boolean;
  isAIDerived?: boolean;
  logicDescription?: string;
}
export type PropertyDefinition = Property;

// Action参数定义
export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'timestamp' | 'object' | 'array';
  required: boolean;
  description: string;
}

// 回滚策略定义 (Rollback Strategy for high-risk actions)
export interface RollbackStrategy {
  type: 'compensating_action' | 'manual' | 'none';
  compensatingAction?: string;    // Name of the action to execute for rollback
  timeoutMinutes?: number;        // Time window for rollback availability
  requiresApproval?: boolean;     // Whether rollback requires approval
}

// Action三层定义
export interface AIPAction {
  name: string;
  nameCn?: string;
  type?: 'traditional' | 'generative' | 'ai-assisted' | 'automated';
  description: string;
  descriptionCn?: string;
  aiLogic?: string;
  aiCapability?: unknown;

  // === 三层定义 ===

  // 业务层 Business Layer
  businessLayer?: {
    description: string;      // 业务描述（自然语言）
    targetObject: string;     // 目标对象
    executorRole: string;     // 执行角色（谁有权限）
    triggerCondition?: string; // 触发条件（什么时候需要执行）
  };

  // 逻辑层 Logic Layer
  logicLayer?: {
    preconditions: string[];  // 前置条件
    parameters: ActionParameter[];  // 输入参数
    postconditions: string[]; // 后置状态变更
    sideEffects?: string[];   // 副作用（通知、日志等）
  };

  // 实现层 Implementation Layer
  implementationLayer?: {
    apiEndpoint?: string;     // API端点 (e.g., /api/orders/{id}/approve)
    apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    requestPayload?: Record<string, any>;  // 请求体结构示例
    agentToolSpec?: {         // Agent Tool规范
      name: string;
      description: string;
      parameters: Record<string, any>;  // JSON Schema格式
    };
  };

  // === 治理属性 (Human-in-the-Loop Governance) ===
  // Permission Tiers for controlled automation:
  //   Tier 1: Full Auto - Read operations, low-risk status changes (no human review)
  //   Tier 2: Auto + Audit - Standard operations with audit trail (async review possible)
  //   Tier 3: Human Confirm - Business-critical ops require human confirmation before execution
  //   Tier 4: Multi-Approve - High-risk/irreversible operations need multiple approvals
  // Higher tier = more human oversight, aligned with increasing business risk
  governance?: {
    permissionTier: 1 | 2 | 3 | 4;  // 权限等级 (1=最自动化, 4=最严格控制)
    requiresHumanApproval: boolean; // 是否需要人工审批
    auditLog: boolean;              // 是否记录审计日志
    riskLevel?: 'low' | 'medium' | 'high';  // 风险等级
  };

  // === 回滚策略 (Rollback Strategy) ===
  // Required for Tier 3-4 actions to ensure recoverability
  rollbackStrategy?: RollbackStrategy;
}

export interface FieldMapping {
  sourceField: string;
  targetPropertyId?: string;       // Stable ID (preferred when available)
  targetPropertyName: string;      // Display name + fallback when property has no id
  transform?: 'direct' | 'concat' | 'unit-conversion' | 'lookup' | 'date-format' | 'custom';
  transformNote?: string;
  required?: boolean;
}

export interface ExternalIntegration {
  id?: string;
  name?: string;
  nameCn?: string;
  type?: string;
  systemName?: string;
  sourceSystem?: string;
  dataPoints?: string[];
  syncedObjects?: string[];
  mechanism?: string;
  frequency?: string;              // legacy — normalized into syncPolicy.frequency
  targetObjectId?: string;
  description?: string;

  // === New fields ===
  direction?: 'import' | 'export' | 'bidirectional';
  syncPolicy?: {
    mode: 'realtime' | 'batch' | 'event-driven' | 'manual';
    frequency?: string;
    retryPolicy?: string;          // Textual description, design-level
    conflictStrategy?: 'source-wins' | 'target-wins' | 'manual-review' | 'last-write-wins';
  };
  fieldMappings?: FieldMapping[];

  [key: string]: unknown;
}
export type Integration = ExternalIntegration;

// ============= State Machine Modeling =============

// 状态转换定义 (State Transition Definition)
export interface StateTransition {
  from: string;           // Source state name
  to: string;             // Target state name
  trigger: string;        // Action or event that triggers the transition
  guard?: string;         // Optional condition that must be true for transition
  description?: string;   // Human-readable description of the transition
}

// 状态定义 (State Definition)
export interface StateDefinition {
  name: string;                   // State name (e.g., 'pending', 'approved', 'rejected')
  description?: string;           // Human-readable description
  isInitial?: boolean;            // Whether this is the initial state
  isFinal?: boolean;              // Whether this is a terminal state
  allowedActions?: string[];      // Actions available in this state
  metadata?: Record<string, any>; // Additional state metadata
}

// 状态机定义 (State Machine Definition)
export interface StateMachine {
  statusProperty: string;         // Property name that holds the status (e.g., 'status', 'state')
  states: StateDefinition[];      // All possible states
  transitions: StateTransition[]; // All valid transitions
  description?: string;           // Human-readable description of the state machine
}

export interface OntologyObject {
  id: string;
  name: string;
  nameCn?: string;            // Chinese name for bilingual support
  description: string;
  descriptionCn?: string;     // Chinese description for bilingual support
  primaryKey?: string;        // Primary key field identifier
  objectType?: 'entity' | 'event' | 'document' | 'reference';  // Object classification
  properties: Property[];
  actions: AIPAction[];
  aiFeatures?: {
    type: AIIntegrationType | string;
    name?: string;
    description: string;
  }[];
  stateMachine?: StateMachine;  // Optional state machine for lifecycle management
}

export interface OntologyLink {
  id: string;
  name?: string;
  nameCn?: string;
  description?: string;
  source?: string;
  target?: string;
  sourceObject?: string;
  targetObject?: string;
  sourceObjectId?: string;
  targetObjectId?: string;
  sourceId?: string;
  targetId?: string;
  label?: string;
  type?: string;
  isSemantic?: boolean;
  cardinality?: '1:1' | '1:N' | 'N:1' | 'N:N' | 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many' | 'manyToOne' | 'oneToMany' | 'manyToMany' | 'oneToOne';  // Relationship cardinality
}

// 用户提出的智能化需求
export interface AIRequirement {
  id: string;
  description: string;           // 需求描述
  extractedFrom: string;         // 从哪段对话提取
  relatedObjects?: string[];     // 关联的 Object IDs
  relatedActions?: string[];     // 关联的 Action 名称
  status: 'identified' | 'validated' | 'implemented' | 'blocked';
  blockedReason?: string;        // 如果被阻塞，原因是什么
}

export interface ProjectState {
  projectName?: string;  // 项目名称（用于云端同步）
  industry: string;
  useCase: string;
  objects: OntologyObject[];
  links: OntologyLink[];
  integrations: ExternalIntegration[];
  aiRequirements: AIRequirement[];  // 用户提出的智能化需求
  status: 'scouting' | 'designing' | 'completed';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  // 系统消息的元数据（用于标记上下文边界）
  metadata?: {
    type?: 'archetype_import' | 'session_start' | 'context_boundary' | 'milestone' | 'project_created';
    archetypeId?: string;
    archetypeName?: string;
    timestamp?: string;
    projectId?: string;       // 关联的项目ID
    snapshotId?: string;      // 关联的快照ID（用于版本回滚）
    tags?: string[];          // 对话标签，用于过滤
  };
}

// ============= Project Management =============

/**
 * 项目状态枚举
 * - draft: 草稿，正在设计中
 * - active: 活跃，设计基本完成，可以使用
 * - archived: 已归档，不再修改但保留查看
 * - completed: 已完成，设计定稿
 */
export type ProjectStatus = 'draft' | 'active' | 'archived' | 'completed';

/**
 * 项目元数据
 * 存储项目的基本信息，不包含具体的本体设计数据
 */
export interface Project {
  id: string;                          // UUID, 唯一标识
  name: string;                        // 项目名称
  description?: string;                // 项目描述
  industry: string;                    // 行业分类
  useCase: string;                     // 使用场景

  // 项目状态生命周期
  status: ProjectStatus;

  // 时间戳 (ISO 8601)
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;

  // 版本控制
  version: number;                     // 设计版本号，每次修改+1

  // 关键引用
  baseArchetypeId?: string;            // 基于哪个原型创建（如果为null，则为从零开始）
  baseArchetypeName?: string;          // 基于的原型名称（用于显示）

  // 搜索与分类
  tags?: string[];                     // 标签：['零售', 'ERP集成', 'AI优化']

  // 云端同步
  cloudProjectId?: string;             // 云端项目ID（如果已同步）
  lastSyncAt?: string;                 // 最后同步时间
}

/**
 * 项目列表视图的简化类型
 * 用于项目列表展示，不需要完整的本体数据
 */
export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  industry: string;
  status: ProjectStatus;
  baseArchetypeName?: string;          // 显示：基于 XXX 模板
  createdAt: string;
  updatedAt: string;
  version: number;
  tags?: string[];
  // 进度指标
  progress: {
    objectCount: number;
    linkCount: number;
    actionCount: number;
    completeness: number;              // 0-100，设计完整度
  };
}

/**
 * 项目会话数据
 * 包含项目的完整工作数据：本体设计 + 聊天记录
 */
export interface ProjectSession {
  projectId: string;                   // 所属项目ID
  project: Project;                    // 项目元数据
  ontologyState: ProjectState;         // 本体设计状态
  chatHistory: ChatMessage[];          // 该项目的聊天记录
}

// ============= AI Provider Settings =============

export type AIProvider = 'gemini' | 'openrouter' | 'zhipu' | 'moonshot' | 'openai' | 'custom';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  baseUrl: string;
  models: AIModelConfig[];
  requiresApiKey: boolean;
}

export interface AIModelConfig {
  id: string;
  name: string;
  description?: string;
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  apiKeys?: Partial<Record<AIProvider, string>>;
  model: string;
  customBaseUrl?: string;
  /**
   * Opt-in for OpenAI-compatible `response_format: json_object` on providers
   * that don't get it by default (notably `custom` gateways like vLLM/Together).
   * Leave undefined to use the provider's default.
   */
  supportsJsonResponseFormat?: boolean;
}

// 预定义的Provider配置
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '统一API访问多种模型（推荐）',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [
      // 2025最新旗舰模型
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: '最新推荐' },
      { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', description: '最强推理' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'OpenAI 最新' },
      { id: 'openai/o3-mini', name: 'o3 Mini', description: '推理模型' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google 最新' },
      { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '快速' },
      // 经济模型
      { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3', description: '性价比之王' },
      { id: 'qwen/qwen-3-235b', name: 'Qwen 3 235B', description: '中文优化' },
      { id: 'meta-llama/llama-4-405b', name: 'Llama 4 405B', description: '开源最强' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: '经济实惠' },
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google AI Studio（支持刷新）',
    baseUrl: 'https://generativelanguage.googleapis.com',
    requiresApiKey: true,
    models: [
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', description: '最新旗舰' },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', description: '最新快速' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '稳定版' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '长上下文' },
    ]
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    description: '智谱AI大模型（支持刷新）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    requiresApiKey: true,
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '旗舰' },
      { id: 'glm-4-air', name: 'GLM-4 Air', description: '高性价比' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', description: '快速免费' },
      { id: 'glm-4v-plus', name: 'GLM-4V Plus', description: '多模态' },
    ]
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    description: '月之暗面 Kimi（支持刷新）',
    baseUrl: 'https://api.moonshot.cn/v1',
    requiresApiKey: true,
    models: [
      { id: 'kimi-k2-0711-preview', name: 'Kimi K2 Preview', description: '最新 K2 模型（推荐）' },
      { id: 'moonshot-v1-auto', name: 'Moonshot v1 Auto', description: '自动选择上下文' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', description: '超长上下文 128K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', description: '长上下文 32K' },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', description: '标准 8K' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI官方API（支持刷新）',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', description: '最新旗舰' },
      { id: 'gpt-4o', name: 'GPT-4o', description: '多模态' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '经济' },
      { id: 'o3-mini', name: 'o3 Mini', description: '推理模型' },
      { id: 'o1', name: 'o1', description: '深度推理' },
    ]
  },
  {
    id: 'custom',
    name: '自定义',
    description: '自定义OpenAI兼容API',
    baseUrl: '',
    requiresApiKey: true,
    models: [
      { id: 'custom', name: '自定义模型', description: '手动输入模型ID' },
    ]
  }
];
