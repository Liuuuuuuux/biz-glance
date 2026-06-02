# BizGlance 设计文档

> 从 Java/Spring Boot 代码自动提取业务流程知识图谱，简洁展示单据流转、状态流转、字段流转。

## 1. 项目定位

### 一句话描述

从 Java/Spring Boot 代码自动提取业务流程知识图谱，简洁展示单据流转、状态流转、字段流转。

### 目标用户

- **业务人员**：理解系统业务流程
- **开发者**：快速定位代码、理解业务逻辑
- **代码审查/交接**：快速了解系统

### 核心价值

不像传统代码图谱那样展示"蜘蛛网"，而是专注于业务视角，用简洁的三层视图展示单据上下游、状态流转、字段血缘。

## 2. 核心功能

### 三层独立视图

| 视图 | 内容 | 交互 |
|------|------|------|
| **单据流转** | 展示单据上下游关系 | 点击节点进入该单据的详情 |
| **状态流转** | 展示单据的状态机 | 状态节点显示触发条件 |
| **字段流转** | 展示字段来源和计算逻辑 | 字段 → 来源 + 计算公式 |

### 筛选功能

- 按单据类型筛选
- 按业务模块筛选
- 按状态筛选

## 3. 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      BizGlance 架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   CLI 入口   │    │  MCP 服务器  │    │  Web 服务   │     │
│  │  bizglance  │    │  (AI调用)   │    │  (可视化)   │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    分析引擎                          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Java Parser  →  AST 分析  →  业务逻辑提取           │   │
│  │       ↓              ↓              ↓               │   │
│  │  实体识别      调用关系分析     状态/字段识别         │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   LLM 语义层                         │   │
│  │  (可选) 理解业务语义、标注单据类型、补充描述          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SQLite 知识图谱存储                  │   │
│  │  节点: 单据/状态/字段  边: 流转/计算/触发            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| **语言** | TypeScript |
| **Java 解析** | tree-sitter-java（跨平台、性能好） |
| **Web 框架** | React + Vite |
| **图可视化** | AntV G6（简洁风格，支持自定义布局） |
| **存储** | SQLite (better-sqlite3) |
| **MCP** | @modelcontextprotocol/sdk |
| **LLM** | 可配置后端（OpenAI / Ollama / ...） |

## 4. 分析引擎核心逻辑

### 第一阶段：静态分析（确定性）

```
Java 源码
    │
    ▼
┌──────────────────┐
│  AST 解析        │  → 识别类、方法、字段、注解
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  实体识别        │  → 识别 @Entity、DTO、VO
│                  │  → 提取字段名、类型、注解
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Service 分析    │  → 识别 Service 层方法
│                  │  → 提取方法调用关系
│                  │  → 识别状态变更逻辑（setStatus）
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Controller 分析 │  → 识别 API 入口
│                  │  → 关联到 Service 方法
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  流转关系提取    │  → A.method() 调用 B.method()
│                  │  → 识别上下游单据关系
└────────┬─────────┘
```

### 第二阶段：业务逻辑识别

| 识别目标 | 识别方式 |
|----------|----------|
| **状态字段** | 字段名含 `status`/`state`，枚举类型 |
| **状态变更** | `setStatus()` 调用，状态机注解 |
| **字段计算** | 赋值表达式分析，识别 `a = b * c` |
| **上下游关系** | Service 方法参数/返回值类型推断 |

### 第三阶段：LLM 语义增强（可选）

```
静态分析结果
    │
    ▼
┌──────────────────────────────┐
│  LLM 分析                    │
│  - 这个类是什么业务单据？     │
│  - 这个状态代表什么业务含义？ │
│  - 这个计算公式的业务语义？   │
└──────────────┬───────────────┘
               │
               ▼
  业务语义标注（单据类型、描述、状态含义）
```

## 5. 数据模型

### 核心实体

```typescript
// 单据/实体
interface Document {
  id: string;
  name: string;           // 类名：PurchaseOrder
  label?: string;         // 业务名称：采购订单（LLM生成）
  type: 'entity' | 'dto' | 'vo';
  module: string;         // 所属模块
  fields: Field[];
  sourceFile: string;     // 源文件路径
}

// 字段
interface Field {
  id: string;
  name: string;           // 字段名：quantity
  type: string;           // 类型：Integer
  label?: string;         // 业务名称：数量（LLM生成）
  isStatus: boolean;      // 是否状态字段
}

// 状态
interface Status {
  id: string;
  documentId: string;     // 所属单据
  value: string;          // 状态值：DRAFT
  label?: string;         // 业务名称：草稿（LLM生成）
  order: number;          // 排序
}

// 状态流转
interface StatusTransition {
  id: string;
  documentId: string;
  fromStatus: string;     // 源状态
  toStatus: string;       // 目标状态
  trigger?: string;       // 触发条件/方法
  description?: string;
}

// 单据流转（上下游关系）
interface DocumentFlow {
  id: string;
  fromDocument: string;   // 上游单据
  toDocument: string;     // 下游单据
  relation: 'creates' | 'updates' | 'references';
  service: string;        // 触发的 Service 方法
}

// 字段流转
interface FieldFlow {
  id: string;
  sourceDocument: string;
  sourceField: string;
  targetDocument: string;
  targetField: string;
  calculation?: string;   // 计算公式：quantity * price
}
```

## 6. CLI 命令设计

```bash
# 初始化项目索引
bizglance init

# 分析代码库
bizglance analyze [path]

# 启动 Web 服务（浏览器查看）
bizglance serve

# 启动 MCP 服务器（供 AI 调用）
bizglance mcp

# 导出图谱数据
bizglance export --format json|html

# 配置 LLM 后端
bizglance config set llm.provider openai
bizglance config set llm.model gpt-4
bizglance config set llm.baseurl http://localhost:11434  # Ollama
```

### 典型使用流程

```bash
# 1. 在项目目录初始化
cd /path/to/java-project
bizglance init

# 2. 分析代码
bizglance analyze .

# 3. 启动 Web 查看结果
bizglance serve
# → 打开浏览器 http://localhost:3000
```

## 7. MCP 工具接口

```typescript
// MCP 工具列表
const tools = [
  {
    name: "bizglance_get_documents",
    description: "获取所有单据列表",
    parameters: { module?: string, type?: string }
  },
  {
    name: "bizglance_get_document_flows",
    description: "获取单据上下游关系",
    parameters: { documentId?: string }
  },
  {
    name: "bizglance_get_status_flow",
    description: "获取单据状态流转",
    parameters: { documentId: string }
  },
  {
    name: "bizglance_get_field_flows",
    description: "获取字段流转关系",
    parameters: { documentId?: string, field?: string }
  },
  {
    name: "bizglance_search",
    description: "搜索单据/字段/状态",
    parameters: { query: string }
  }
];
```

### AI 调用示例

```
用户: 采购订单有哪些下游单据？

AI 调用: bizglance_get_document_flows({ documentId: "PurchaseOrder" })
返回: → 入库单、应付单
```

## 8. Web 界面设计

### 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  BizGlance                              [搜索框] [设置]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                          │
│  │  筛选面板   │                                          │
│  │             │                                          │
│  │ 模块: [全部▾]                                        │
│  │ 类型: [全部▾]                                        │
│  │ 状态: [全部▾]                                        │
│  │             │                                          │
│  │ ─────────── │                                          │
│  │ 单据列表    │                                          │
│  │ ○ 采购订单  │                                          │
│  │ ○ 销售订单  │                                          │
│  │ ○ 入库单    │                                          │
│  │ ...         │                                          │
│  └─────────────┘                                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │              主视图区域                                │ │
│  │         （单据流转 / 状态流转 / 字段流转）             │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 视图切换

顶部 Tab 切换：`[单据流转] [状态流转] [字段流转]`

- 单据流转视图：左侧筛选 + 主区域展示上下游关系图
- 状态流转视图：选中单据后展示状态机
- 字段流转视图：选中单据后展示字段来源

## 9. 项目目录结构

```
bizglance/
├── packages/
│   ├── core/                    # 核心分析引擎
│   │   ├── src/
│   │   │   ├── parser/          # Java AST 解析
│   │   │   ├── analyzer/        # 业务逻辑分析
│   │   │   │   ├── entity.ts    # 实体识别
│   │   │   │   ├── service.ts   # Service 分析
│   │   │   │   ├── status.ts    # 状态识别
│   │   │   │   └── flow.ts      # 流转关系提取
│   │   │   ├── llm/             # LLM 语义增强
│   │   │   └── store/           # SQLite 存储
│   │   └── package.json
│   │
│   ├── cli/                     # CLI 入口
│   │   ├── src/
│   │   │   ├── commands/        # 命令实现
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── web/                     # Web 前端
│   │   ├── src/
│   │   │   ├── components/      # React 组件
│   │   │   ├── views/           # 三个视图
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── mcp/                     # MCP 服务器
│       ├── src/
│       │   └── server.ts
│       └── package.json
│
├── package.json                 # Monorepo 根
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 10. 实现阶段

### Phase 1: MVP（核心分析 + 单据流转视图）

| 功能 | 说明 |
|------|------|
| Java AST 解析 | 使用 tree-sitter-java |
| 实体识别 | 识别 @Entity 类和字段 |
| Service 分析 | 提取方法调用关系 |
| 单据流转视图 | 基础上下游关系展示 |
| CLI 基础命令 | init, analyze, serve |
| SQLite 存储 | 持久化分析结果 |

### Phase 2: 状态流转 + 字段流转

| 功能 | 说明 |
|------|------|
| 状态字段识别 | 识别 status/state 字段 |
| 状态变更提取 | 分析 setStatus 调用 |
| 字段计算分析 | 提取赋值表达式 |
| 状态流转视图 | 状态机可视化 |
| 字段流转视图 | 字段来源展示 |

### Phase 3: LLM 增强 + MCP

| 功能 | 说明 |
|------|------|
| LLM 集成 | 可配置后端 |
| 业务语义标注 | 单据类型、状态含义 |
| MCP 服务器 | 供 AI 助手调用 |
| 筛选优化 | 按模块/类型/状态筛选 |

## 11. 成功标准

| 场景 | 验证方式 |
|------|----------|
| 分析现有系统 | 对一个 Java/Spring Boot 项目运行分析，能正确识别核心单据和流转关系 |
| 业务人员使用 | 非技术人员能看懂单据流转图，理解业务流程 |
| 开发辅助 | 开发者能快速定位"这个字段从哪里来" |
| AI 集成 | Claude Code 能通过 MCP 查询业务逻辑 |
