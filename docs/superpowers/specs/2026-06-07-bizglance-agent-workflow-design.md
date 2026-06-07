# BizGlance Agent 工作流设计稿

> 目标：为 BizGlance 增加类似 Understand-Anything `/understand` 的代理入口，让用户用一个自然的 agent 命令完成业务知识图谱初始化、分析、校验和预览。第一阶段不追求独立 AST 引擎，继续复用现有 CodeGraph 辅助分析能力。

## 1. 背景与结论

当前 BizGlance 已经具备 `core`、`cli`、`web` 三层雏形：

- `core` 定义 `BizGlanceDocument`，并能把 `CodeGraphAssistedAnalysisInput` 合成为业务图谱文档。
- `cli` 提供 `analyze`、`serve`、`smoke` 三个底层命令。
- `web` 能读取 `bizglance.json` 并展示业务对象、单据流转、状态流转、字段血缘和代码证据。

但当前还缺少一个面向用户的“一键理解业务系统”入口。用户仍需要手动准备 CodeGraph context、让 LLM 生成 findings、再调用 CLI 合成文档。这与 Understand-Anything 的 `/understand` 体验有明显差距。

推荐路线是：

**新增 `/bizglance` agent/skill 入口作为主交互形态，保留 CLI 作为可测试、可复用的底层执行器。**

## 2. 产品形态

### 2.1 一句话描述

`/bizglance` 分析本地代码仓库，生成 `.bizglance/bizglance.json`，并打开业务分析工作台，帮助用户从业务对象、流程、状态和字段血缘理解系统。

### 2.2 目标体验

用户在代理环境中运行：

```text
/bizglance [path] [--full] [--review] [--language zh] [--no-serve]
```

第一版推荐支持：

- `/bizglance`：分析当前目录。
- `/bizglance <path>`：分析指定本地仓库目录。
- `/bizglance --full`：忽略缓存，重新生成业务图谱。
- `/bizglance --review`：基于已有图谱重新执行语义审查。
- `/bizglance --language zh`：指定业务描述输出语言。
- `/bizglance --no-serve`：只生成 JSON，不启动工作台。

### 2.3 与 CLI 的关系

Agent 入口负责“编排和交互”，CLI 负责“执行和可测”：

- Agent 解析用户意图、创建目录、调用 CodeGraph、组织 LLM 分析、报告进度。
- CLI 读取标准化输入、校验 schema、写出 BizGlance 文档、启动 Web 预览。
- `core` 继续只放纯数据模型、转换逻辑、校验逻辑和可单测的分析函数。

这样可以同时获得 Understand-Anything 式体验和工程上的可维护性。

## 3. 工作目录设计

新增项目级目录：

```text
.bizglance/
  config.json
  bizglance.json
  meta.json
  intermediate/
    codegraph-context.json
    llm-findings.json
    codegraph-assisted-input.json
  tmp/
```

### 3.1 文件职责

- `config.json`：保存语言、是否自动打开工作台、默认 lens 等用户偏好。
- `bizglance.json`：最终业务知识图谱文档，供 Web 工作台读取。
- `meta.json`：保存生成时间、git commit、context hash、BizGlance 版本。
- `intermediate/codegraph-context.json`：CodeGraph 结构事实输出。
- `intermediate/llm-findings.json`：LLM 语义归纳结果。
- `intermediate/codegraph-assisted-input.json`：传给现有 `analyze` 的合并输入。
- `tmp/`：临时文件，不作为稳定接口。

## 4. 分层架构

```text
用户
  │
  ▼
/bizglance Agent Skill
  - 参数解析
  - 进度报告
  - CodeGraph 调用
  - LLM findings 生成
  - CLI 编排
  │
  ▼
BizGlance CLI
  - init / analyze / validate / serve
  - 文件读写
  - 错误消息
  │
  ▼
BizGlance Core
  - schema
  - findings 校验和修复
  - CodeGraph assisted 转换
  │
  ▼
BizGlance Web
  - 业务图谱工作台
  - 证据侧栏
```

### 4.1 Agent Skill 职责

Agent Skill 不直接实现复杂业务逻辑。它主要负责：

- 识别目标仓库路径。
- 检查 `.bizglance/` 是否存在。
- 决定 full、incremental、review-only 的执行路径。
- 调用 CodeGraph 获取结构上下文。
- 用固定提示词让 LLM 生成业务 findings。
- 调用 CLI 校验和合成 `bizglance.json`。
- 根据参数决定是否启动工作台。
- 把每个阶段的进度和失败原因清楚反馈给用户。

### 4.2 CLI 职责

CLI 应逐步补齐这些命令：

- `bizglance init [repo]`：创建 `.bizglance/`、默认配置和 ignore 文件。
- `bizglance analyze [repo] --context <path>`：复用当前能力，生成业务图谱。
- `bizglance validate <input>`：校验 LLM findings 和最终文档。
- `bizglance serve --data <path>`：预览业务图谱。
- `bizglance smoke`：保留可复现冒烟验收。

第一阶段可以只新增 `init` 和 `validate`，其余复用已有 `analyze`、`serve`、`smoke`。

### 4.3 Core 职责

Core 需要从“类型定义”升级为“稳定契约层”：

- 为 `CodeGraphAssistedAnalysisInput` 增加运行时 schema。
- 为 `BizGlanceDocument` 增加运行时 schema。
- 规范 LLM findings 的字段别名、默认值和错误提示。
- 保证每个 business object、flow、status mutation、field lineage 都能关联 evidence。

## 5. `/bizglance` 执行流程

### Phase 0: Pre-flight

- 解析目标目录，默认当前工作目录。
- 检查目录是否存在。
- 检查是否是 git 仓库，能获取 commit 时写入 `meta.json`。
- 确保 `.bizglance/`、`intermediate/`、`tmp/` 存在。
- 读取或创建 `config.json`。

### Phase 1: CodeGraph Context

- 调用外部 CodeGraph 获取结构事实。
- 输出 `.bizglance/intermediate/codegraph-context.json`。
- 如果 CodeGraph 不可用，给出明确错误和手动命令建议。
- 第一阶段不内置 AST fallback。

### Phase 2: LLM Business Findings

Agent 使用固定输出契约，让 LLM 从 CodeGraph context 中产出：

- `businessObjects`
- `flows`
- `statusMutations`
- `fieldLineages`

每个 finding 必须包含：

- 技术名或对象引用。
- 业务说明。
- `confidence`。
- `evidence`，优先包含 `nodeName`、`filePath`、`startLine`、`endLine`、`route`。

输出保存到 `.bizglance/intermediate/llm-findings.json`。

### Phase 3: Assemble

- 合并 `codegraph-context.json` 和 `llm-findings.json`。
- 生成 `.bizglance/intermediate/codegraph-assisted-input.json`。
- 调用 `bizglance analyze <repo> --context <merged-input> --out .bizglance/bizglance.json`。

### Phase 4: Validate

- 校验 `bizglance.json` 是否符合 `BizGlanceDocument`。
- 校验 evidence 引用是否存在。
- 检查业务对象为空、关系为空、低置信度过多等风险。
- 对非致命问题写入 `meta.warnings`，对致命问题停止并报告。

### Phase 5: Serve

- 如果未传 `--no-serve`，调用 `bizglance serve --data .bizglance/bizglance.json`。
- 输出本地访问 URL。
- 如果启动失败，保留 JSON 输出并提示用户可手动运行 serve。

## 6. LLM 输出契约

Agent prompt 需要明确要求 LLM 只输出 JSON，结构等价于：

```json
{
  "businessObjects": [],
  "flows": [],
  "statusMutations": [],
  "fieldLineages": []
}
```

约束：

- 不允许编造不存在的文件路径和行号。
- 没有证据的结论必须标为 `low`，并说明原因。
- 结构事实和业务推断必须分开。
- 业务命名优先使用用户指定语言。
- 字段血缘只在 CodeGraph context 中有足够证据时生成。

## 7. 与 Understand-Anything 的取舍

应该借鉴：

- 单一 agent 命令入口。
- 项目级隐藏目录保存图谱和中间产物。
- full、review、language 等参数。
- 分阶段进度报告。
- schema 校验和自动修复。
- 后续增量更新能力。

不应该第一阶段照搬：

- Tree-sitter 主解析管道。
- 多语言 AST 插件系统。
- Louvain 分批调度。
- Git hook 自动更新。
- 复杂多 agent 文件分析体系。

BizGlance 的第一目标不是“完整代码结构图谱”，而是“从可靠结构事实中提炼业务理解”。
Understand-Anything path:
F:\study\GitHub\Understand-AnythingF:\study\GitHub\Understand-Anything

## 8. 错误处理

### 8.1 CodeGraph 不可用

停止执行，并提示：

- 当前缺少 CodeGraph context。
- 可以先运行 CodeGraph 初始化。
- 或传入已有 context 文件继续分析。

### 8.2 LLM 输出无法解析

保留原始输出到 `tmp/`，报告 JSON 解析错误，并建议重试 `--review` 或 `--full`。

### 8.3 findings 证据不足

不停止，但在图谱中保留低置信度标记，并写入 warnings。

### 8.4 Web 预览失败

不影响分析结果。保留 `.bizglance/bizglance.json`，提示手动运行 `bizglance serve`。

## 9. 分阶段路线

### Phase 1: Agent MVP

- 新增 `skills/bizglance/SKILL.md` 或等价插件入口。
- 新增 `.bizglance/` 初始化流程。
- 复用现有 `analyze` 和 `serve`。
- 让 `/bizglance` 能从 CodeGraph context 到 Web 工作台跑通完整闭环。

### Phase 2: 契约强化

- 增加运行时 schema 校验。
- 增加 findings 自动修复和清晰错误报告。
- 增加 `bizglance validate`。
- 补齐测试 fixture。

### Phase 3: 体验增强

- 支持 `--full`、`--review`、`--language`、`--no-serve`。
- 保存 `meta.json`。
- 基于 commit/context hash 判断是否需要重新分析。

### Phase 4: 插件化发布

- 增加 `.codex-plugin/plugin.json` 或目标代理平台的插件描述。
- 补安装和使用文档。
- 让 BizGlance 可以作为独立 agent skill 安装。

## 10. 验收标准

第一阶段成立需要满足：

- 用户可以运行 `/bizglance` 分析当前目录。
- 系统会创建 `.bizglance/`。
- 能生成 `.bizglance/bizglance.json`。
- 生成结果符合现有 `BizGlanceDocument`。
- Web 工作台能读取生成结果。
- 失败时能说明卡在哪个阶段，而不是只抛底层异常。

## 11. 推荐下一步

下一步应先实现 Agent MVP，而不是先重构分析引擎：

1. 设计并添加 `skills/bizglance/SKILL.md`。
2. 给 CLI 增加最小 `init` 命令。
3. 给 Core 增加 `CodeGraphAssistedAnalysisInput` 的运行时校验。
4. 用现有 shop fixture 做 `/bizglance` 的可复现验收。

这样可以尽快得到 Understand-Anything 式的一键体验，同时避免过早陷入 AST、增量引擎和多 agent 调度的复杂度。
