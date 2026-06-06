# BizGlance 设计文档

> 从代码库自动提取业务视角知识图谱，简洁展示业务对象、业务流程、状态变更和字段流转。

## 1. 项目定位

### 一句话描述

从各种项目代码中自动提取业务视角知识图谱，简洁展示业务对象、业务流程、状态变更和字段流转。第一版先聚焦 Java/Spring Boot 项目，用 ERP 与在线教育两个样例验证通用性。

### 目标用户

- **业务人员**：理解系统业务流程
- **开发者**：快速定位代码、理解业务逻辑
- **代码审查/交接**：快速了解系统

### 核心价值

不像传统代码图谱那样展示"蜘蛛网"，而是专注于业务视角，用简洁的三层视图展示业务流程地图、对象关系、字段血缘。ERP/RuoYi 是第一阶段验证样本之一，不是产品边界；在线教育、CRM、内容平台等系统也应能用同一套业务对象模型表达。

## 2. 核心功能

### 三层独立视图

| 视图 | 内容 | 交互 |
|------|------|------|
| **业务流程地图** | 按业务阶段展示业务对象之间的上下游关系 | 点击业务对象查看业务解释、上下游摘要和证据入口 |
| **对象关系** | 展示业务对象的引用、生成、更新、解锁等关系 | 从当前对象展开邻近关系 |
| **字段来源** | 展示字段来源和计算逻辑 | 字段 → 来源 + 计算公式 |

状态流转第一版作为业务对象详情中的摘要能力，完整状态机可视化放到 Phase 2。

### 筛选功能

- 按业务对象类型筛选
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
│  │  (可选) 理解业务语义、标注对象类型、补充描述          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SQLite 知识图谱存储                  │   │
│  │  节点: 业务对象/状态/字段  边: 流转/计算/触发         │   │
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
│  业务证据提取    │  → 操作入口、业务对象、状态变更、对象关系
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
│  - 这个类是什么业务对象？     │
│  - 这个状态代表什么业务含义？ │
│  - 这个计算公式的业务语义？   │
└──────────────┬───────────────┘
               │
               ▼
  业务语义标注（对象类型、描述、状态含义、阶段文案）
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

// 业务对象。ERP 场景下的"单据"只是 BusinessObject 的一种展示语义。
interface BusinessObject {
  id: string;
  name: string;           // 类名：PurchaseOrder / LearningProgress
  label?: string;         // 业务名称：采购订单 / 学习进度（LLM生成）
  technicalKind: 'entity' | 'dto' | 'vo' | 'service' | 'route' | 'other';
  businessKind?: 'document' | 'record' | 'process' | 'resource' | 'event' | 'other';
  module: string;         // 所属模块
  domain?: string;        // 业务域：ERP / 在线教育 / CRM 等
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
  objectId: string;       // 所属业务对象
  value: string;          // 状态值：DRAFT / COMPLETED
  label?: string;         // 业务名称：草稿 / 已完成（LLM生成）
  order: number;          // 排序
}

// 状态流转
interface StatusTransition {
  id: string;
  objectId: string;
  fromStatus: string;     // 源状态
  toStatus: string;       // 目标状态
  trigger?: string;       // 触发条件/方法
  description?: string;
}

// MVP 状态变更证据
interface StatusMutation {
  id: string;
  operationId: string;
  objectId: string;
  field: string;          // status
  valueSource: string;    // request body、method param、constant、expression
  evidence: CodeSymbol[]; // Controller → Service → Mapper 的代码证据
}

// 业务对象流转（上下游关系）
interface BusinessFlow {
  id: string;
  fromObject: string;     // 上游业务对象
  toObject: string;       // 下游业务对象
  relation: 'creates' | 'updates' | 'references' | 'unlocks' | 'generates' | 'depends_on';
  label?: string;         // 展示文案：生成订单 / 解锁测评 / 生成证书
  stage?: string;         // 展示阶段：发起采购 / 开始学习 / 认证沉淀
  service?: string;       // 触发的 Service 方法
  operationId?: string;   // 关联操作入口
}

// 字段流转
interface FieldFlow {
  id: string;
  sourceObject: string;
  sourceField: string;
  targetObject: string;
  targetField: string;
  calculation?: string;   // 计算公式：quantity * price
}
```

### 场景映射示例

- ERP：`PurchaseOrder` 是 `BusinessObject.businessKind = 'document'`，页面可展示为"采购订单"。
- 在线教育：`LearningProgress` 是 `BusinessObject.businessKind = 'process'`，页面展示为"学习进度"。
- 内容平台：`ArticleReview` 可作为 `process` 或 `event`，用于表达审核流程。

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
    name: "bizglance_get_business_objects",
    description: "获取所有业务对象列表",
    parameters: { module?: string, businessKind?: string, domain?: string }
  },
  {
    name: "bizglance_get_business_flows",
    description: "获取业务对象上下游关系",
    parameters: { objectId?: string, domain?: string }
  },
  {
    name: "bizglance_get_status_flow",
    description: "获取业务对象状态流转",
    parameters: { objectId: string }
  },
  {
    name: "bizglance_get_field_flows",
    description: "获取字段流转关系",
    parameters: { objectId?: string, field?: string }
  },
  {
    name: "bizglance_search",
    description: "搜索业务对象/字段/状态",
    parameters: { query: string }
  }
];
```

### AI 调用示例

```
用户: 学习进度会影响哪些后续业务？

AI 调用: bizglance_get_business_flows({ objectId: "LearningProgress" })
返回: → 作业提交、测评成绩、学习证书

用户: 采购订单有哪些下游单据？

AI 调用: bizglance_get_business_flows({ objectId: "PurchaseOrder" })
返回: → 入库单、应付单
```

## 8. Web 界面设计

### 默认页面：业务流程地图

BizGlance 第一版默认面向业务人员，不直接暴露代码图谱。首页使用 **业务流程地图**：

- 主体沿用业务对象上下游关系图，保证第一版能从代码中稳定抽取。
- 视觉上按业务阶段组织节点，例如"选课报名 → 开始学习 → 任务测评 → 认证沉淀"。
- 右侧默认展示业务解释和上下游摘要，代码证据默认折叠，开发者需要时再展开。
- 缺少业务语义时，页面使用类名、模块名、路由名作为兜底展示，不阻塞预览。

### 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  BizGlance                  [流程地图] [对象关系] [字段来源] │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌───────────────────────┐ ┌─────────────┐ │
│ │ 业务对象列表 │ │      业务流程地图      │ │  业务解释   │ │
│ │ 搜索/模块筛选│ │                       │ │ 当前对象说明 │ │
│ │              │ │  1 选课报名           │ │ 上下游摘要   │ │
│ │ ● 学习进度   │ │  课程 → 报名记录       │ │ 关键状态/规则│ │
│ │ ○ 课程       │ │                       │ │              │ │
│ │ ○ 报名记录   │ │  2 开始学习           │ │ 代码证据折叠 │ │
│ │ ○ 测评成绩   │ │  报名记录 → 学习进度   │ │              │ │
│ │ ○ 学习证书   │ │                       │ │              │ │
│ │              │ │                       │ │              │ │
│ │              │ │  3 任务测评/认证      │ │              │ │
│ │              │ │  学习进度 → 证书       │ │              │ │
│ └──────────────┘ └───────────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 视图切换

顶部 Tab 切换：`[流程地图] [对象关系] [字段来源]`

- 流程地图视图：默认视图，按业务阶段展示业务对象上下游关系。
- 对象关系视图：更纯粹的上下游关系图，用于查看某个业务对象从哪里来、到哪里去。
- 字段来源视图：选中业务对象后展示字段来源和计算逻辑。

状态流转在 MVP 中作为右侧详情的"关键状态"摘要出现；完整状态机可视化放到 Phase 2。

### 非 ERP 主样例：在线教育

在线教育样例用于验证 BizGlance 的通用性，避免产品被 ERP/单据语义锁住：

```
课程 → 报名记录 → 学习进度 → 作业提交 / 测评成绩 → 学习证书
```

- `Course`：课程详情、章节、价格。
- `Enrollment`：确认学生学习资格。
- `LearningProgress`：记录章节完成率，是连接任务、测评、证书的过程对象。
- `AssignmentSubmission`：学习进度达标后解锁。
- `QuizResult`：计算是否通过。
- `Certificate`：测评通过后自动生成。

ERP 样例仍可展示为"采购申请 → 采购订单 → 入库单 → 应付单"，但这是同一套 `BusinessObject` 与 `BusinessFlow` 的行业文案。

### MVP 展示契约

前端第一版不等待完整语义识别，核心数据只需要支撑业务人员看懂流程：

- `BusinessObject.label`：优先展示业务名称；为空时展示类名。
- `BusinessObject.module`：用于左侧筛选和阶段兜底。
- `BusinessObject.businessKind`：用于区分单据、记录、过程对象、资源、事件等展示语义。
- `BusinessFlow.relation`：用于画出上下游箭头。
- `BusinessFlow.label`：用于显示"解锁测评"、"生成证书"等关系文案。
- `BusinessFlow.service`：作为证据入口，默认折叠。
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
| 样本链路 | 跑通一条真实 Java/Spring 状态变更链路，并提供在线教育手写 JSON 用于前端验收 |
| 状态变更提取 | 识别 `changeStatus`、`updateStatus`、`LambdaUpdateWrapper.set(...status...)` |
| JSON 输出 | 生成 `bizglance.json`，包含 `BusinessObject`、`BusinessFlow`、操作入口、状态变更和代码证据 |

### Phase 1: Web 预览 + 通用业务对象流转

| 功能 | 说明 |
|------|------|
| CLI 基础命令 | init, analyze, serve |
| 业务对象识别 | 从 Domain/BO/VO/DTO、Entity 和路由上下文归并业务对象 |
| 业务流程地图 | 默认 Web 视图，按业务阶段展示业务对象上下游关系 |
| 对象关系视图 | 纯上下游关系图，作为流程地图的辅助视图 |
| 非 ERP 样例 | 在线教育样例可展示课程、报名、学习进度、测评、证书流程 |
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
| 业务语义标注 | 业务对象类型、状态含义、阶段文案 |
| MCP 服务器 | 供 AI 助手调用 |
| 筛选优化 | 按模块、业务对象类型、状态筛选 |

## 11. 成功标准

| 场景 | 验证方式 |
|------|----------|
| 分析现有系统 | 对一个 Java/Spring Boot 项目运行分析，能正确识别核心业务对象和流转关系 |
| ERP 样例 | 能表达采购申请 → 采购订单 → 入库单 → 应付单 |
| 在线教育样例 | 能表达课程 → 报名记录 → 学习进度 → 作业/测评 → 学习证书 |
| 业务人员使用 | 非技术人员能看懂业务流程地图，理解业务流程 |
| 开发辅助 | 开发者能快速定位"这个字段从哪里来" |
| AI 集成 | Claude Code 能通过 MCP 查询业务逻辑 |
