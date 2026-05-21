# Ontology Architect

[English](#english) | [中文](#中文) | [Français](#français) | [日本語](#日本語) | [Español](#español) | [العربية](#العربية)

---

## English

> AI-powered ontology design tool — model objects, actions, and AI interfaces from conversation to export-ready deliverables.

Ontology Architect is a **design and planning tool** that helps teams architect enterprise ontologies through natural language conversation. It covers the full lifecycle from requirement discovery to deliverable export — you design the ontology here, then implement it in your runtime of choice.

## Why Ontology?

Most enterprise data initiatives stop at objects and relationships — a knowledge graph you can query but never act on. The ontology paradigm goes further, and this tool helps you design for all three layers:

```
Knowledge Graph    Objects ── Links ──▶ Objects           (static, query-only)

Ontology           Objects ── Links ──▶ Objects
                      └── Actions ─────────────────▶      (executable by design)

AI + Ontology      Objects ── Links ──▶ Objects
                      └── Actions ◀── LLM ────────▶ "approve this order"
```

**1. Objects + Links — what data governance already solved.**
Entities, properties, relationships. Every knowledge graph, MDM platform, or data catalog does this. It's necessary but insufficient — you can query the graph, but it can't *do* anything.

**2. Actions — what makes Ontology executable by design.**
Approvals, alerts, dispatches, calculations. When you model Actions with preconditions, parameters, and postconditions, you're designing a system that *can* execute — not just describe. This is the essential difference between an ontology and a knowledge graph. Ontology Architect helps you define these three-layer Action specifications so they're ready for implementation.

**3. AI/LLM — what makes Actions describable for natural language interfaces.**
When actions are semantically described with clear business context, an LLM can understand, recommend, and route them. Ontology Architect generates Agent Tool specifications (OpenAI, LangChain, Claude, MCP formats) so your Actions are ready to be wired into AI agents and natural language interfaces at deployment time.

### Decision-First Principle

> If an Object or Action doesn't directly support a user's operational decision, it doesn't belong in the core Ontology.

## 5-Phase Design Workflow

```
Discover → Model → Integrate → AI Design → Deliver
```

| Phase | Purpose | Key Activities |
|-------|---------|---------------|
| 1. Discover | Requirement scouting | Conversational entity extraction, multi-modal document upload |
| 2. Model | Ontology modeling | Object/Action/Link definition, three-layer Action design |
| 3. Integrate | Data source mapping | External system connections, sync mechanism planning |
| 4. AI Design | AI enhancement | AI opportunity analysis, Agent Tool specification |
| 5. Deliver | Export & packaging | Quality gate, document generation, ZIP export |

## Key Capabilities

### Review Panel (Quality + Readiness)
- **Quality Check** — 16 rule-based validations covering objects, actions, links, integrations, architecture
- **Readiness Check** — Phase progress tracking, blocking issue detection, prioritized next actions
- Accessible from the chat bar; slides out as a side panel with tab switching

### Delivery Center (Phase 5)
- Design completeness overview (4-dimension stats: objects, actions, links, integrations)
- Dual export mode: internal draft vs. client delivery (with hard quality gates)
- One-click ZIP packaging: cover page, 5 technical documents, delivery metadata

### Industry Templates
- 11 pre-built archetypes: financial AML, smart manufacturing, healthcare FHIR, defense intelligence, etc.
- JSON import/export for sharing; one-click apply to current project
- Lazy-loaded data chunks (~600 KB total, loaded per-template on demand)

### Internationalization (i18n)
- 6 languages: English, Chinese, French, Spanish, Arabic, Japanese
- 10 namespaces × 6 locales, 1,374 keys per language
- `useAppTranslation(ns)` hook with `t()` for UI text, `lt()` for data-layer `{en,cn}` objects

### Authentication & Cloud Sync
- Browse tutorials/templates without login; create/edit projects after sign-in
- JWT auth (access 15min + refresh 7 days) with Argon2id password hashing
- Offline-first localStorage with debounced cloud sync (Serializable isolation)

### Multi-Provider AI
- Supported providers: Google Gemini, OpenAI, OpenRouter, Zhipu GLM, Moonshot (Kimi), custom OpenAI-compatible
- Multi-modal: PDF, Office documents, images (provider-dependent capabilities)
- Methodology-driven system prompts (1000+ lines of ontology design guidance)

### Action Three-Layer Definition

```
┌─────────────────────────────────────────────────────────┐
│ Business:  Manager approves purchase orders over ¥100k  │
│ Logic:     Pre[status=pending AND amount>100000]        │
│            Params[order_id, decision, notes]            │
│            Post[status→approved/rejected]               │
│ Implement: POST /api/orders/{id}/approve                │
│            Tool: approve_purchase_order(order_id, ...)   │
└─────────────────────────────────────────────────────────┘
```

### Learning Center
- 4-level progressive curriculum with interactive exercises
- Real-world case library (manufacturing, retail, logistics)
- Achievement system with progress tracking

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19 + TypeScript + Vite (port 3000) |
| Styling | Tailwind CSS + Lucide Icons + CSS Variables theme system |
| State | React Context (Auth → Sync → Project provider hierarchy) |
| i18n | react-i18next (6 languages, 10 namespaces) |
| Storage | localStorage (offline-first) + cloud sync |
| Backend | Fastify 5 + Prisma + PostgreSQL |
| AI | Multi-provider abstraction (Gemini, OpenAI, OpenRouter, Zhipu, Moonshot, custom) |
| Testing | Playwright (E2E) + Vitest (unit) |
| Design | Plus Jakarta Sans + JetBrains Mono, Perfect Fourth (1.333) type scale |

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd openFDE
npm install

# Start dev server
npm run dev
```

App runs at http://localhost:3000.

### Configure AI

1. Click **Settings** (gear icon) in the sidebar
2. Select provider → choose model → enter API key
3. Verify connection status

### Create First Project

1. New users see the **Quick Start** guide
2. Click **Create Project** → choose blank or from industry template
3. Start chatting to describe your business scenario

## Project Structure

```
openFDE/
├── App.tsx                        # Main app orchestration, Review panel, routing
├── pages/
│   ├── ScoutingPage.tsx           # Phase 1: Requirement discovery
│   ├── ModelingPage.tsx           # Phase 2: Ontology modeling
│   ├── IntegrationPage.tsx        # Phase 3: Data source integration
│   ├── AIEnhancementPage.tsx      # Phase 4: AI enhancement analysis
│   ├── DeliveryPage.tsx           # Phase 5: Export & packaging
│   ├── ProjectsPage.tsx           # Project management dashboard
│   └── QuickStartPage.tsx         # New user onboarding
├── components/
│   ├── GlobalChatBar.tsx          # Chat input with file upload & review button
│   ├── QualityPanel.tsx           # Quality check (rules + three-layer)
│   ├── ReadinessPanel.tsx         # Readiness check (progress + blockers + actions)
│   ├── StructuringWorkbench.tsx   # Object/Action/Link editing workspace
│   ├── OntologyVisualizer.tsx     # Ontology relationship graph
│   ├── ActionDesigner.tsx         # Three-layer Action editor
│   ├── DeliverableGenerator.tsx   # Document generation & ZIP export
│   ├── UnifiedSettings.tsx        # AI config, theme, language, data management
│   ├── ArchetypeBrowser.tsx       # Industry template browser
│   ├── Academy.tsx                # Learning center
│   ├── ChangeHistoryPanel.tsx     # Design change tracking
│   └── auth/                      # Login, register, user menu
├── contexts/
│   ├── AuthContext.tsx             # JWT auth state
│   ├── SyncContext.tsx             # Cloud sync state
│   └── ProjectContext.tsx          # Multi-project state, auto-save
├── services/
│   ├── aiService.ts               # Multi-provider AI abstraction (~1800 lines)
│   ├── aiAnalysisService.ts       # Phase 4 AI enhancement analysis
│   ├── archetypeGeneratorService.ts # Industry archetype generation with web search
│   ├── syncService.ts             # Cloud sync client
│   └── authService.ts             # Auth API client
├── lib/
│   ├── storage.ts                 # User-scoped localStorage + quota management
│   ├── i18n.ts                    # react-i18next configuration (6 languages)
│   ├── documentParser.ts          # Office document parsing (dynamic imports)
│   ├── jsonUtils.ts               # AI response JSON extraction (shared)
│   ├── apiKeyUtils.ts             # Provider API key resolution (shared)
│   ├── llmCapabilities.ts         # Model capability scoring & recommendations
│   ├── modelRegistry.ts           # Model discovery with caching
│   └── themes.ts                  # 10 themes (5 dark + 5 light)
├── hooks/
│   ├── useAppTranslation.ts       # i18n hook: t() for UI, lt() for data
│   ├── useModelRegistry.ts        # Model list with debounced refresh
│   └── useProjects.ts             # Project CRUD operations
├── utils/
│   ├── qualityChecker.ts          # 16-rule quality validation engine
│   ├── readinessChecker.ts        # Phase progress & blocker detection
│   ├── apiGenerator.ts            # OpenAPI spec generation from Actions
│   └── toolGenerator.ts           # Agent Tool spec (OpenAI/LangChain/Claude/MCP)
├── locales/
│   ├── en/                        # English (10 namespace JSON files)
│   ├── cn/                        # Chinese
│   ├── fr/                        # French
│   ├── es/                        # Spanish
│   ├── ar/                        # Arabic
│   └── ja/                        # Japanese
├── content/
│   ├── archetypes/                # 11 industry templates (lazy-loaded)
│   ├── cases/                     # Real-world case library
│   └── lessons/                   # Learning center curriculum
├── tests/
│   ├── e2e/                       # Playwright E2E tests
│   └── cardinality.test.ts        # Link normalization unit tests
├── backend/                       # Fastify + Prisma + PostgreSQL
│   ├── src/
│   │   ├── modules/               # Auth, projects, sync, preferences, archetypes
│   │   └── middleware/             # Helmet, CORS, CSRF, rate limiting
│   ├── prisma/                    # Database schema & migrations
│   └── tests/                     # Backend unit tests (Vitest)
├── types.ts                       # Core type definitions
├── types/archetype.ts             # Template type definitions
├── vite.config.ts                 # Build config with code-splitting
├── playwright.config.ts           # E2E test configuration
└── CHANGELOG.md                   # Version history & release notes
```

## Development

```bash
npm run dev              # Vite dev server (localhost:3000)
npm run build            # Production build
npm run check            # Full quality gate: tests + tsc + build + i18n check
npm run test:e2e         # Playwright E2E tests

# Backend (from backend/ directory)
cd backend
npm run dev              # Watch mode
npm run db:migrate       # Prisma migrations
npm run db:studio        # Prisma Studio GUI
```

## Versions & Changes

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and release notes.

---

## 中文

> AI 驱动的本体设计工具 — 从对话到可交付设计文档，建模对象、动作与 AI 接口。

Ontology Architect（本体架构师）是一个**设计与规划工具**，帮助团队通过自然语言对话构建企业本体架构。它覆盖从需求发现到交付物导出的完整设计生命周期 — 在这里完成本体设计，然后在你选择的运行时中实现它。

### 为什么需要 Ontology？

大多数企业数据项目止步于对象和关系 — 一个只能查询却无法行动的知识图谱。本体范式更进一步，本工具帮助你为这三个层次做设计：

```
知识图谱         对象 ── 关系 ──▶ 对象                   （静态，只能查询）

本体             对象 ── 关系 ──▶ 对象
                   └── 动作 ─────────────────▶            （设计上可执行）

AI + 本体        对象 ── 关系 ──▶ 对象
                   └── 动作 ◀── LLM ────────▶ "审批这笔订单"
```

**1. 对象 + 关系 — 数据治理早已解决的问题。**
实体、属性、关系。每个知识图谱、主数据管理平台都做了这件事。必要但不充分 — 你可以查询图谱，但它什么也做不了。

**2. 动作 — 让 Ontology 在设计上可执行的关键。**
审批、预警、调度、计算。当你为动作建模前置条件、参数和后置条件时，你在设计一个*能够*执行的系统 — 而不只是描述。这是本体和知识图谱的本质区别。本工具帮助你定义这些三层 Action 规范，使其可以直接进入实现阶段。

**3. AI/LLM — 让动作可以被自然语言描述和调用。**
当动作被清晰的业务语境语义化描述后，LLM 就能理解、推荐并路由它们。本工具生成 Agent Tool 规范（OpenAI、LangChain、Claude、MCP 格式），让你的 Action 在部署时可以直接接入 AI Agent 和自然语言接口。

### 决策优先原则

> 如果一个对象或动作不直接支持用户的业务决策，就不属于核心本体。

### 五阶段设计流程

| 阶段 | 目标 | 核心活动 |
|------|------|---------|
| 1. 发现 | 需求探索 | 对话式实体提取，多模态文档上传 |
| 2. 建模 | 本体建模 | 对象/动作/关系定义，三层 Action 设计 |
| 3. 集成 | 数据源映射 | 外部系统连接，同步机制规划 |
| 4. AI 设计 | AI 增强 | AI 机会分析，Agent Tool 规范 |
| 5. 交付 | 导出打包 | 质量门禁，文档生成，ZIP 导出 |

### 主要能力

- **审阅面板** — 16 条规则质量检查 + 阶段就绪度检查（进度追踪、阻塞检测、优先行动建议）
- **交付中心** — 设计完整度概览，双模式导出（内部草稿 / 客户交付），一键 ZIP 打包
- **行业模板** — 11 个预置原型（金融 AML、智能制造、医疗 FHIR、国防情报等），JSON 导入导出
- **国际化** — 6 种语言（英文、中文、法语、西班牙语、阿拉伯语、日语），10 命名空间 × 1,374 键/语言
- **多供应商 AI** — Google Gemini、OpenAI、OpenRouter、智谱 GLM、Moonshot、自定义兼容接口
- **认证与云同步** — JWT 认证 + Argon2id 密码哈希，离线优先 localStorage + 去抖云同步

### 快速开始

```bash
git clone <repository-url>
cd openFDE
npm install
npm run dev
```

应用运行在 http://localhost:3000。进入 **设置**（齿轮图标）配置 AI 供应商和 API Key。

---

## Français

> Outil de conception d'ontologies propulsé par l'IA — modélisez objets, actions et interfaces IA, de la conversation aux livrables prêts à l'export.

Ontology Architect est un **outil de conception et de planification** qui aide les équipes à architecturer des ontologies d'entreprise par la conversation en langage naturel. Il couvre le cycle de vie complet de la conception, de la découverte des besoins à l'export des livrables — vous concevez l'ontologie ici, puis vous l'implémentez dans le runtime de votre choix.

### Pourquoi l'Ontologie ?

La plupart des projets de données d'entreprise s'arrêtent aux objets et aux relations — un graphe de connaissances interrogeable mais incapable d'agir. Le paradigme ontologique va plus loin, et cet outil vous aide à concevoir pour les trois couches :

```
Graphe de           Objets ── Liens ──▶ Objets            (statique, lecture seule)
connaissances

Ontologie            Objets ── Liens ──▶ Objets
                        └── Actions ─────────────────▶     (exécutable par conception)

IA + Ontologie       Objets ── Liens ──▶ Objets
                        └── Actions ◀── LLM ────────▶ « approuver cette commande »
```

**1. Objets + Liens — ce que la gouvernance des données a déjà résolu.**
Entités, propriétés, relations. Chaque graphe de connaissances et plateforme MDM le fait déjà. C'est nécessaire mais insuffisant — on peut interroger le graphe, mais il ne peut rien *faire*.

**2. Actions — ce qui rend l'Ontologie exécutable par conception.**
Approbations, alertes, dispatching, calculs. Quand vous modélisez des Actions avec préconditions, paramètres et postconditions, vous concevez un système qui *peut* exécuter — pas seulement décrire. C'est la différence essentielle entre une ontologie et un graphe de connaissances. Ontology Architect vous aide à définir ces spécifications Action en 3 couches, prêtes pour l'implémentation.

**3. IA/LLM — ce qui rend les Actions descriptibles pour les interfaces en langage naturel.**
Quand les actions sont décrites sémantiquement avec un contexte métier clair, un LLM peut les comprendre, les recommander et les router. Ontology Architect génère des spécifications Agent Tool (formats OpenAI, LangChain, Claude, MCP) pour que vos Actions soient prêtes à être connectées aux agents IA et aux interfaces en langage naturel au moment du déploiement.

### Principe Decision-First

> Si un objet ou une action ne soutient pas directement une décision opérationnelle, il n'a pas sa place dans l'ontologie.

### Workflow en 5 phases

| Phase | Objectif | Activités clés |
|-------|----------|---------------|
| 1. Découverte | Exploration des besoins | Extraction d'entités par conversation, import de documents multi-modaux |
| 2. Modélisation | Modélisation ontologique | Définition objets/actions/liens, conception Action en 3 couches |
| 3. Intégration | Mapping des sources de données | Connexions aux systèmes externes, planification de la synchronisation |
| 4. Conception IA | Enrichissement IA | Analyse des opportunités IA, spécification Agent Tool |
| 5. Livraison | Export et packaging | Contrôle qualité, génération de documents, export ZIP |

### Capacités principales

- **Panneau de revue** — 16 règles de validation qualité + vérification de maturité par phase
- **Centre de livraison** — Vue de complétude, double mode d'export (brouillon interne / livraison client), packaging ZIP en un clic
- **Templates industriels** — 11 archétypes pré-construits (AML financier, manufacturing, santé FHIR, défense, etc.)
- **Internationalisation** — 6 langues (anglais, chinois, français, espagnol, arabe, japonais), 1 374 clés par langue
- **IA multi-fournisseurs** — Google Gemini, OpenAI, OpenRouter, Zhipu GLM, Moonshot, interface compatible personnalisée
- **Authentification & sync cloud** — JWT + Argon2id, localStorage offline-first avec synchronisation cloud

### Démarrage rapide

```bash
git clone <repository-url>
cd openFDE
npm install
npm run dev
```

L'application est accessible sur http://localhost:3000. Allez dans **Paramètres** (icône engrenage) pour configurer le fournisseur IA et la clé API.

---

## 日本語

> AI駆動のオントロジー設計ツール — 会話からエクスポート可能な成果物まで、オブジェクト・アクション・AIインターフェースをモデリング。

Ontology Architectは、自然言語での対話を通じてエンタープライズオントロジーの設計を支援する**設計・計画ツール**です。要件の発見から成果物のエクスポートまで、設計ライフサイクル全体をカバーします — ここでオントロジーを設計し、お好みのランタイムで実装してください。

### なぜオントロジーか？

多くのエンタープライズデータプロジェクトは、オブジェクトとリレーションシップで終わります — クエリはできるが行動はできないナレッジグラフです。オントロジーのパラダイムはさらに先へ進み、本ツールはこの3つのレイヤーすべてを設計する支援をします：

```
ナレッジグラフ     オブジェクト ── リンク ──▶ オブジェクト    （静的、クエリのみ）

オントロジー       オブジェクト ── リンク ──▶ オブジェクト
                      └── アクション ─────────────────▶      （設計上実行可能）

AI + オントロジー  オブジェクト ── リンク ──▶ オブジェクト
                      └── アクション ◀── LLM ────────▶ 「この注文を承認して」
```

**1. オブジェクト + リンク — データガバナンスがすでに解決したもの。**
エンティティ、プロパティ、リレーション。すべてのナレッジグラフやMDMプラットフォームがこれを行っています。必要だが不十分 — グラフにクエリはできますが、何も*実行*できません。

**2. アクション — オントロジーを設計上実行可能にするもの。**
承認、アラート、ディスパッチ、計算。アクションに前提条件、パラメータ、事後条件をモデリングすることで、単に記述するだけでなく*実行できる*システムを設計できます。これがオントロジーとナレッジグラフの本質的な違いです。本ツールは、実装にそのまま移行できる3層アクション仕様の定義を支援します。

**3. AI/LLM — アクションを自然言語インターフェース向けに記述可能にするもの。**
アクションが明確なビジネスコンテキストでセマンティックに記述されると、LLMはそれを理解し、推薦し、ルーティングできます。本ツールはAgent Tool仕様（OpenAI、LangChain、Claude、MCPフォーマット）を生成し、デプロイ時にAIエージェントや自然言語インターフェースに接続できる状態にします。

### Decision-First原則

> オブジェクトやアクションがユーザーの業務上の意思決定を直接支援しないなら、コアオントロジーに含めるべきではありません。

### 5フェーズ設計ワークフロー

| フェーズ | 目的 | 主な活動 |
|---------|------|---------|
| 1. ディスカバリー | 要件探索 | 対話によるエンティティ抽出、マルチモーダルドキュメントアップロード |
| 2. モデリング | オントロジー設計 | オブジェクト/アクション/リンク定義、3層アクション設計 |
| 3. インテグレーション | データソースマッピング | 外部システム接続、同期メカニズム設計 |
| 4. AI設計 | AI強化 | AI活用機会分析、Agent Toolスペック |
| 5. デリバリー | エクスポート＆パッケージ | 品質ゲート、ドキュメント生成、ZIPエクスポート |

### 主な機能

- **レビューパネル** — 16ルールの品質チェック + フェーズ準備状況チェック（進捗追跡、ブロッカー検出、優先アクション提案）
- **デリバリーセンター** — 設計完全性の概要、デュアルモードエクスポート（内部ドラフト/顧客納品）、ワンクリックZIPパッケージ
- **業界テンプレート** — 11種のプリセット（金融AML、スマート製造、医療FHIR、防衛インテリジェンスなど）
- **国際化（i18n）** — 6言語対応（英語、中国語、フランス語、スペイン語、アラビア語、日本語）、言語あたり1,374キー
- **マルチプロバイダーAI** — Google Gemini、OpenAI、OpenRouter、Zhipu GLM、Moonshot、カスタム互換インターフェース
- **認証＆クラウド同期** — JWT + Argon2idパスワードハッシュ、オフラインファーストlocalStorage + デバウンスクラウド同期

### クイックスタート

```bash
git clone <repository-url>
cd openFDE
npm install
npm run dev
```

http://localhost:3000 でアプリが起動します。**設定**（歯車アイコン）からAIプロバイダーとAPIキーを設定してください。

---

## Español

> Herramienta de diseño de ontologías impulsada por IA — modele objetos, acciones e interfaces de IA, desde la conversación hasta entregables listos para exportar.

Ontology Architect es una **herramienta de diseño y planificación** que ayuda a los equipos a diseñar ontologías empresariales mediante conversación en lenguaje natural. Cubre el ciclo de vida completo del diseño, desde el descubrimiento de requisitos hasta la exportación de entregables — usted diseña la ontología aquí y luego la implementa en el runtime de su elección.

### ¿Por qué Ontología?

La mayoría de las iniciativas de datos empresariales se detienen en objetos y relaciones — un grafo de conocimiento que se puede consultar pero sobre el que no se puede actuar. El paradigma de ontología va más allá, y esta herramienta le ayuda a diseñar para las tres capas:

```
Grafo de             Objetos ── Enlaces ──▶ Objetos         (estático, solo consulta)
conocimiento

Ontología            Objetos ── Enlaces ──▶ Objetos
                        └── Acciones ─────────────────▶      (ejecutable por diseño)

IA + Ontología       Objetos ── Enlaces ──▶ Objetos
                        └── Acciones ◀── LLM ────────▶ "aprobar este pedido"
```

**1. Objetos + Enlaces — lo que la gobernanza de datos ya resolvió.**
Entidades, propiedades, relaciones. Cada grafo de conocimiento y plataforma MDM ya lo hace. Es necesario pero insuficiente — se puede consultar el grafo, pero no puede *hacer* nada.

**2. Acciones — lo que hace la Ontología ejecutable por diseño.**
Aprobaciones, alertas, despachos, cálculos. Cuando modela Acciones con precondiciones, parámetros y postcondiciones, está diseñando un sistema que *puede* ejecutar — no solo describir. Esta es la diferencia esencial entre una ontología y un grafo de conocimiento. Ontology Architect le ayuda a definir estas especificaciones de Acción en 3 capas, listas para la implementación.

**3. IA/LLM — lo que hace las Acciones descriptibles para interfaces de lenguaje natural.**
Cuando las acciones se describen semánticamente con un contexto empresarial claro, un LLM puede comprenderlas, recomendarlas y enrutarlas. Ontology Architect genera especificaciones de Agent Tool (formatos OpenAI, LangChain, Claude, MCP) para que sus Acciones estén listas para conectarse a agentes de IA e interfaces de lenguaje natural en el momento del despliegue.

### Principio Decision-First

> Si un objeto o una acción no apoya directamente una decisión operativa del usuario, no pertenece a la ontología central.

### Flujo de trabajo en 5 fases

| Fase | Objetivo | Actividades clave |
|------|----------|-------------------|
| 1. Descubrimiento | Exploración de requisitos | Extracción de entidades por conversación, importación de documentos multimodales |
| 2. Modelado | Modelado ontológico | Definición de objetos/acciones/enlaces, diseño de Acción en 3 capas |
| 3. Integración | Mapeo de fuentes de datos | Conexiones a sistemas externos, planificación de sincronización |
| 4. Diseño IA | Enriquecimiento IA | Análisis de oportunidades IA, especificación Agent Tool |
| 5. Entrega | Exportación y empaquetado | Control de calidad, generación de documentos, exportación ZIP |

### Capacidades principales

- **Panel de revisión** — 16 reglas de validación de calidad + verificación de madurez por fase
- **Centro de entrega** — Vista de completitud, doble modo de exportación (borrador interno / entrega al cliente), empaquetado ZIP en un clic
- **Plantillas industriales** — 11 arquetipos preconstruidos (AML financiero, manufactura, salud FHIR, defensa, etc.)
- **Internacionalización** — 6 idiomas (inglés, chino, francés, español, árabe, japonés), 1.374 claves por idioma
- **IA multi-proveedor** — Google Gemini, OpenAI, OpenRouter, Zhipu GLM, Moonshot, interfaz compatible personalizada
- **Autenticación y sincronización en la nube** — JWT + Argon2id, localStorage offline-first con sincronización en la nube

### Inicio rápido

```bash
git clone <repository-url>
cd openFDE
npm install
npm run dev
```

La aplicación está disponible en http://localhost:3000. Vaya a **Configuración** (icono de engranaje) para configurar el proveedor de IA y la clave API.

---

## العربية

> أداة تصميم أونتولوجيا مدعومة بالذكاء الاصطناعي — صمّم الكائنات والإجراءات وواجهات الذكاء الاصطناعي، من المحادثة إلى مخرجات جاهزة للتصدير.

Ontology Architect هي **أداة تصميم وتخطيط** تساعد الفرق على بناء أونتولوجيا المؤسسات من خلال المحادثة بالّغة الطبيعية. تغطي دورة حياة التصميم الكاملة من اكتشاف المتطلبات إلى تصدير المخرجات — صمّم الأونتولوجيا هنا، ثم نفّذها في بيئة التشغيل التي تختارها.

### لماذا الأونتولوجيا؟

تتوقف معظم مبادرات بيانات المؤسسات عند الكائنات والعلاقات — رسم بياني معرفي يمكن الاستعلام عنه لكن لا يمكنه التنفيذ. نموذج الأونتولوجيا يذهب أبعد من ذلك، وهذه الأداة تساعدك على التصميم للطبقات الثلاث:

```
Knowledge Graph    كائنات ── روابط ──▶ كائنات           (ثابت، استعلام فقط)

Ontology           كائنات ── روابط ──▶ كائنات
                      └── إجراءات ─────────────────▶     (قابل للتنفيذ بالتصميم)

AI + Ontology      كائنات ── روابط ──▶ كائنات
                      └── إجراءات ◀── LLM ────────▶ "اعتمد هذا الطلب"
```

**1. كائنات + روابط — ما حلّته حوكمة البيانات بالفعل.**
كيانات وخصائص وعلاقات. كل رسم بياني معرفي ومنصة MDM تفعل ذلك. ضروري لكنه غير كافٍ — يمكنك الاستعلام من الرسم البياني، لكنه لا يستطيع *فعل* شيء.

**2. الإجراءات — ما يجعل الأونتولوجيا قابلة للتنفيذ بالتصميم.**
الموافقات والتنبيهات والإرسال والحسابات. عندما تنمذج الإجراءات بشروط مسبقة ومعاملات وشروط لاحقة، فأنت تصمم نظاماً *يمكنه* التنفيذ — وليس مجرد الوصف. هذا الفرق الجوهري بين الأونتولوجيا والرسم البياني المعرفي. يساعدك Ontology Architect على تحديد مواصفات الإجراءات ذات الطبقات الثلاث، جاهزة للتنفيذ.

**3. الذكاء الاصطناعي/LLM — ما يجعل الإجراءات قابلة للوصف لواجهات اللغة الطبيعية.**
عندما تُوصف الإجراءات دلالياً بسياق أعمال واضح، يمكن لـ LLM فهمها والتوصية بها وتوجيهها. يُنشئ Ontology Architect مواصفات Agent Tool (بصيغ OpenAI وLangChain وClaude وMCP) ليكون إجراءاتك جاهزة للربط بوكلاء الذكاء الاصطناعي وواجهات اللغة الطبيعية عند النشر.

### مبدأ القرار أولاً

> إذا لم يدعم كائن أو إجراء قراراً تشغيلياً للمستخدم بشكل مباشر، فلا مكان له في الأونتولوجيا الأساسية.

### سير العمل في 5 مراحل

| المرحلة | الهدف | الأنشطة الرئيسية |
|---------|-------|-------------------|
| 1. الاكتشاف | استكشاف المتطلبات | استخلاص الكيانات بالمحادثة، استيراد مستندات متعددة الأنماط |
| 2. النمذجة | نمذجة الأونتولوجيا | تعريف الكائنات/الإجراءات/الروابط، تصميم الإجراء بـ 3 طبقات |
| 3. التكامل | ربط مصادر البيانات | الاتصال بالأنظمة الخارجية، تخطيط المزامنة |
| 4. تصميم الذكاء الاصطناعي | إثراء بالذكاء الاصطناعي | تحليل فرص الذكاء الاصطناعي، مواصفات Agent Tool |
| 5. التسليم | التصدير والتعبئة | فحص الجودة، إنشاء المستندات، تصدير ZIP |

### القدرات الرئيسية

- **لوحة المراجعة** — 16 قاعدة للتحقق من الجودة + فحص نضج كل مرحلة
- **مركز التسليم** — عرض اكتمال التصميم، وضع تصدير مزدوج (مسودة داخلية / تسليم للعميل)، تعبئة ZIP بنقرة واحدة
- **قوالب صناعية** — 11 نموذجاً جاهزاً (AML المالي، التصنيع، الصحة FHIR، الدفاع، إلخ)
- **تعدد اللغات** — 6 لغات (الإنجليزية، الصينية، الفرنسية، الإسبانية، العربية، اليابانية)، 1,374 مفتاحاً لكل لغة
- **ذكاء اصطناعي متعدد المزودين** — Google Gemini، OpenAI، OpenRouter، Zhipu GLM، Moonshot، واجهة مخصصة متوافقة
- **المصادقة والمزامنة السحابية** — JWT + Argon2id، localStorage أولاً مع مزامنة سحابية

### البدء السريع

```bash
git clone <repository-url>
cd openFDE
npm install
npm run dev
```

التطبيق متاح على http://localhost:3000. اذهب إلى **الإعدادات** (أيقونة الترس) لتكوين مزود الذكاء الاصطناعي ومفتاح API.

---

## License

MIT License
