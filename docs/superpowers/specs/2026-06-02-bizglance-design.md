# BizGlance 设计文档

> 从代码库自动提取业务视角知识图谱，简洁展示业务对象、操作入口、状态变更和字段流转。

## 1. 项目定位

### 一句话描述

从各种项目代码中自动提取业务视角知识图谱，简洁展示业务对象、操作入口、状态变更和字段流转。第一版先聚焦 Java/Spring Boot 项目，用一条真实样本链路验证可行性。

### 目标用户

- **业务人员**：理解系统业务流程
- **开发者**：快速定位代码、理解业务逻辑
- **代码审查/交接**：快速了解系统

### 核心价值

不像传统代码图谱那样展示"蜘蛛网"，而是专注于业务视角，用简洁的三层视图展示业务对象关系、状态流转、字段血缘。ERP/RuoYi 是第一阶段验证样本，不是长期边界。

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
│  │                Source Graph Provider                 │   │
│  │  codegraph CLI/MCP/SDK → 符号、路由、调用、文件索引   │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    BizGlance Core                    │   │
│  │  统一中间模型 → 证据归一化 → 业务图谱输出             │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Domain Lens                       │   │
│  │  Java/Spring Lens → Controller/Service/Entity/Mapper │   │
│  │  未来扩展: Django/Rails/Node/移动端/数据项目          │   │
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
| **源码结构提供者** | codegraph（MVP 先本地 CLI 调用，后续可切换 SDK 或自研解析） |
| **第一版领域 Lens** | Java/Spring Lens（Controller、Service、Entity/Domain、Mapper） |
| **Web 框架** | React + Vite |
| **图可视化** | AntV G6（简洁风格，支持自定义布局） |
| **存储** | MVP 先导出 JSON；后续使用 SQLite (better-sqlite3) |
| **MCP** | @modelcontextprotocol/sdk |
| **LLM** | 可配置后端（OpenAI / Ollama / ...） |

## 4. 分析引擎核心逻辑

### MVP 阶段：Provider + Lens（确定性）

```
目标代码库
    │
    ▼
┌──────────────────┐
│  codegraph 索引  │  → 识别文件、符号、路由、调用关系
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Core 归一化     │  → SourceFile、CodeSymbol、Route、CallEdge
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Java/Spring Lens │  → Controller、Service、Domain、Mapper
│                  │  → 接口到实现、Service 到 Mapper
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  业务证据提取    │  → 操作入口、状态字段、状态变更、持久化边
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  图谱输出        │  → bizglance.json
└────────┬─────────┘
```

### 第二阶段：业务逻辑识别

| 识别目标 | 识别方式 |
|----------|----------|
| **状态字段** | 字段名含 `status`/`state`，枚举类型，或框架约定字段 |
| **状态变更** | `setStatus()`、`updateStatus()`、`changeStatus()`、`LambdaUpdateWrapper.set(...)` |
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
// 源码结构提供者输出的统一符号
interface CodeSymbol {
  id: string;
  name: string;
  kind: 'file' | 'class' | 'interface' | 'method' | 'field' | 'route';
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

// 操作入口
interface Operation {
  id: string;
  route?: string;         // PUT /system/user/changeStatus
  method: string;         // changeStatus
  sourceSymbolId: string;
  businessAction?: 'create' | 'read' | 'update' | 'delete' | 'status_change' | 'other';
}

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

// MVP 状态变更证据
interface StatusMutation {
  id: string;
  operationId: string;
  documentId: string;
  field: string;          // status
  valueSource: string;    // request body、method param、constant、expression
  evidence: CodeSymbol[]; // Controller → Service → Mapper 的代码证据
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

# MVP：使用 codegraph + Java/Spring Lens 导出业务图谱 JSON
bizglance analyze [path] --provider codegraph --lens java-spring --out bizglance.json

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

### 默认页面：业务流程地图

BizGlance 第一版默认面向业务人员，不直接暴露代码图谱。首页使用 **业务流程地图**：

- 主体沿用单据上下游关系图，保证第一版能从代码中稳定抽取。
- 视觉上按业务阶段组织节点，例如"发起采购 → 执行采购 → 收货与结算"。
- 右侧默认展示业务解释和上下游摘要，代码证据默认折叠，开发者需要时再展开。
- 缺少业务语义时，页面使用类名、模块名、路由名作为兜底展示，不阻塞预览。

### 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  BizGlance                  [流程地图] [单据关系] [字段来源] │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌───────────────────────┐ ┌─────────────┐ │
│ │ 业务对象列表 │ │      业务流程地图      │ │  业务解释   │ │
│ │ 搜索/模块筛选│ │                       │ │ 当前单据说明 │ │
│ │              │ │  1 发起采购           │ │ 上下游摘要   │ │
│ │ ● 采购订单   │ │  采购申请 → 采购订单   │ │ 关键状态     │ │
│ │ ○ 采购申请   │ │                       │ │              │ │
│ │ ○ 入库单     │ │  2 执行采购           │ │ 代码证据折叠 │ │
│ │ ○ 应付单     │ │  采购订单 → 入库单     │ │              │ │
│ │              │ │                       │ │              │ │
│ │              │ │  3 收货与结算         │ │              │ │
│ │              │ │  入库单 → 应付单       │ │              │ │
│ └──────────────┘ └───────────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 视图切换

顶部 Tab 切换：`[流程地图] [单据关系] [字段来源]`

- 流程地图视图：默认视图，按业务阶段展示单据上下游关系。
- 单据关系视图：更纯粹的上下游关系图，用于查看某个单据从哪里来、到哪里去。
- 字段来源视图：选中单据后展示字段来源和计算逻辑。

状态流转在 MVP 中作为右侧详情的"关键状态"摘要出现；完整状态机可视化放到 Phase 2。

### MVP 展示契约

前端第一版不等待完整语义识别，核心数据只需要支撑业务人员看懂流程：

- `Document.label`：优先展示业务名称；为空时展示类名。
- `Document.module`：用于左侧筛选和阶段兜底。
- `DocumentFlow.relation`：用于画出上下游箭头。
- `DocumentFlow.service`：作为证据入口，默认折叠。
- `StatusMutation.evidence`：用于开发者展开查看 Controller → Service → Mapper 证据链。
- 业务阶段、流程摘要、关系文案可以先用规则生成，后续再由 LLM 增强。

## 9. 项目目录结构

```
bizglance/
├── packages/
│   ├── core/                    # 核心分析引擎
│   │   ├── src/
│   │   │   ├── providers/       # Source Graph Provider 适配层
│   │   │   │   └── codegraph.ts # MVP: 本地 codegraph CLI 调用
│   │   │   ├── lenses/          # 技术栈/领域 Lens
│   │   │   │   └── java-spring/ # Controller/Service/Domain/Mapper 规则
│   │   │   ├── graph/           # 统一中间模型和图谱输出
│   │   │   ├── llm/             # LLM 语义增强
│   │   │   └── store/           # JSON/SQLite 存储
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

### Phase 0: 最小 MVP（codegraph + Java/Spring Lens + JSON）

| 功能 | 说明 |
|------|------|
| codegraph Provider | 调用本地 `codegraph`，读取文件、符号、路由、调用关系 |
| Java/Spring Lens | 识别 Controller、Service 接口/实现、Domain/BO/VO、Mapper |
| 样本链路 | 先跑通 RuoYi-Vue-Plus 的 `changeStatus` 类状态变更链路 |
| 状态变更提取 | 识别 `changeStatus`、`updateStatus`、`LambdaUpdateWrapper.set(...status...)` |
| JSON 输出 | 生成 `bizglance.json`，包含业务对象、操作入口、状态变更和代码证据 |

### Phase 1: Web 预览 + 单据/业务对象流转

| 功能 | 说明 |
|------|------|
| CLI 基础命令 | init, analyze, serve |
| 单据/业务对象识别 | 从 Domain/BO/VO/DTO 和路由上下文归并业务对象 |
| 业务流程地图 | 默认 Web 视图，按业务阶段展示单据上下游关系 |
| 单据关系视图 | 纯上下游关系图，作为流程地图的辅助视图 |
| SQLite 存储 | 持久化分析结果 |

### Phase 2: 状态流转 + 字段流转

| 功能 | 说明 |
|------|------|
| 状态字段识别 | 扩展 status/state、枚举、框架约定字段 |
| 状态变更提取 | 扩展 setStatus、条件分支、状态机注解和框架 API |
| 字段计算分析 | 提取赋值表达式 |
| 状态流转视图 | 从右侧摘要升级为完整状态机可视化 |
| 字段流转视图 | 字段来源展示 |

### Phase 3: 多 Lens + LLM 增强 + MCP

| 功能 | 说明 |
|------|------|
| 多技术栈 Lens | 增加 Django、Rails、Node、移动端、数据项目等 Lens |
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
