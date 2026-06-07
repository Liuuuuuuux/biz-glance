# BizGlance 插件式 LLM 业务生成规划

> 目标：把 BizGlance 从“消费外部 findings 的 CLI/Web 工具”升级为“Claude Code / Codex 可用的业务理解插件”。核心方向是参考 Understand-Anything 的多 skill、多 agent、脚本协作设计，但输出目标聚焦业务知识图谱，而不是通用代码结构图谱。

## 1. 结论

BizGlance 的业务理解必须基于代码事实。这里的关键区别不是“是否分析代码”，而是：

- 代码事实层负责稳定、可复现地回答“代码里有什么”。
- LLM 业务层负责基于代码事实回答“这些代码表达了什么业务”。
- 审查层负责确认业务结论是否有证据、是否过度推断、是否需要降置信度。
- 合成层负责把结构事实和业务结论装配成 `BizGlanceDocument`。

因此，BizGlance 应该参考 Understand-Anything 的插件式流水线，但不要第一阶段照搬它的完整 AST 解析、多语言插件系统和复杂图布局。推荐路径是：

```text
/bizglance
  -> 确定性代码事实提取
  -> 多 agent 业务语义分析
  -> reviewer 审查证据和置信度
  -> CLI assemble / validate
  -> Web 工作台预览
```

## 2. 当前状态

当前 BizGlance 已经具备这些基础：

- `packages/core` 定义 `BizGlanceDocument`、业务对象、流程、状态变更、字段血缘和证据模型。
- `packages/cli` 提供 `init`、`analyze`、`validate`、`workflow`、`serve`、`smoke` 等命令。
- `packages/web` 可以展示业务对象、单据流转、状态流转、字段血缘和代码证据。
- `.codex-plugin/plugin.json` 和 `skills/bizglance/SKILL.md` 已经具备 Codex 插件雏形。

但当前 “LLM 生成业务 findings” 还不是项目内部能力。现有 `analyze` 命令要求传入一个已经包含 `codegraph` 和 `findings` 的 context 文件：

```json
{
  "codegraph": {},
  "findings": {
    "businessObjects": [],
    "flows": [],
    "statusMutations": [],
    "fieldLineages": []
  }
}
```

也就是说，现在的 BizGlance 主要负责：

- 校验 CodeGraph-assisted 输入。
- 把已有 findings 转换为 `BizGlanceDocument`。
- 输出和预览业务工作台。

它还没有真正完成：

- 自动采集业务相关代码事实。
- 自动调度 LLM 生成业务 findings。
- 多 agent 分工分析业务对象、流程、状态和字段。
- reviewer 审查 findings 是否基于证据。
- 插件命令一键跑完整闭环。

## 3. 为什么要参考 Understand-Anything

Understand-Anything 值得借鉴的不是某一个具体 prompt，而是它的工程组织方式：

- 用 skill 作为用户入口，例如 `/understand`。
- 用脚本做便宜、确定性的预处理，减少 LLM 工具调用成本。
- 用多个 agent 分析不同层面，避免一个大 prompt 同时做所有事。
- 用中间产物保存每个阶段结果，便于复查和增量更新。
- 用 reviewer 检查图谱质量，而不是盲目信任第一次 LLM 输出。
- 用 dashboard 将结果变成可探索的产品体验。

BizGlance 应该借鉴这些点，但要调整分析目标：

| 维度 | Understand-Anything | BizGlance 推荐目标 |
| --- | --- | --- |
| 核心问题 | 这个代码库结构如何组织 | 这个系统的业务如何运转 |
| 主要节点 | 文件、函数、类、模块、依赖 | 业务对象、业务动作、状态、字段、证据 |
| 图谱重点 | 技术架构和依赖关系 | 业务流程、状态流转、字段血缘 |
| LLM 任务 | 总结代码结构和关系 | 从代码事实中提炼业务语义 |
| 用户场景 | 新人理解代码库 | 研发、测试、业务共同理解系统规则 |

## 4. 目标体验

用户在 Claude Code 或 Codex 中运行：

```text
/bizglance [path] [--full] [--review] [--language zh] [--no-serve]
```

插件应完成：

1. 初始化 `.bizglance/` 工作目录。
2. 提取目标仓库的业务相关代码事实。
3. 调度 LLM agents 生成业务 findings。
4. 审查 findings 的证据、置信度和一致性。
5. 合成 `.bizglance/bizglance.json`。
6. 校验输出契约。
7. 启动 Web 工作台，或在 `--no-serve` 时只输出 JSON。

最终用户不需要手动准备 `codegraph-assisted-input.json`。手动传入 context 仍可作为高级模式或调试模式保留。

## 5. 总体架构

推荐架构如下：

```text
用户
  |
  v
/bizglance skill
  - 参数解析
  - 进度报告
  - 阶段编排
  |
  v
deterministic preprocessors
  - CodeGraph context
  - route/entity/status/field extractors
  - README/package/git metadata
  |
  v
business analysis agents
  - business-object-agent
  - business-flow-agent
  - status-mutation-agent
  - field-lineage-agent
  |
  v
review agents
  - evidence-reviewer
  - business-graph-reviewer
  |
  v
BizGlance CLI
  - assemble
  - validate
  - serve
  |
  v
BizGlance Web
  - 业务对象
  - 单据流转
  - 状态流转
  - 字段血缘
  - 代码证据
```

## 6. 分层职责

### 6.1 代码事实层

代码事实层只回答“代码里有什么”，不输出业务结论。

输入来源：

- CodeGraph MCP 或 CLI 输出。
- 轻量脚本扫描的 README、package manifest、目录树。
- 针对常见框架的入口提取，例如 controller、route、service、entity、DTO、enum。

建议输出：

```text
.bizglance/intermediate/
  codegraph-context.json
  repo-context.json
  entrypoints.json
  entity-candidates.json
  status-candidates.json
  field-candidates.json
```

第一阶段可以只强依赖 CodeGraph，脚本作为增强项逐步补齐。

### 6.2 LLM 业务分析层

LLM 业务分析层基于代码事实生成结构化 findings。

推荐拆成四个 agent：

| Agent | 职责 | 输出 |
| --- | --- | --- |
| `business-object-agent` | 识别业务对象、技术名、业务名、模块、用途 | `businessObjects[]` |
| `business-flow-agent` | 识别对象之间的创建、更新、引用、流转关系 | `flows[]` |
| `status-mutation-agent` | 识别状态字段、触发点、状态前后变化 | `statusMutations[]` |
| `field-lineage-agent` | 识别字段来源、计算表达式、落点字段 | `fieldLineages[]` |

每个 agent 必须输出 JSON，不允许输出解释性正文。每个 finding 都应尽量携带 evidence。

### 6.3 审查层

审查层不新增业务结论，只审查已有 findings。

推荐两个 reviewer：

- `evidence-reviewer`：检查 evidence 是否存在、路径和行号是否来自代码事实、是否出现编造路径。
- `business-graph-reviewer`：检查业务对象重复、关系悬空、状态字段缺对象、字段血缘引用不存在、置信度是否过高。

审查输出不应该直接覆盖原始 findings，而是输出 patch 或 warnings：

```json
{
  "warnings": [],
  "downgrades": [],
  "removals": [],
  "normalizations": []
}
```

第一阶段可以先让 reviewer 产出 warnings，由 CLI validate 保持最终硬校验。

### 6.4 合成层

合成层由 CLI 和 core 负责，不交给 LLM。

职责：

- 合并 `codegraph` 和各 agent findings。
- 生成 `.bizglance/intermediate/codegraph-assisted-input.json`。
- 调用现有 `analyzeCodeGraphContext` 生成 `BizGlanceDocument`。
- 执行运行时 schema 校验。
- 输出 `.bizglance/bizglance.json` 和 `.bizglance/meta.json`。

## 7. 插件目录建议

BizGlance 可以保留当前 monorepo，但插件能力要集中可发现：

```text
biz-glance/
  .codex-plugin/
    plugin.json
  .claude-plugin/
    plugin.json
    marketplace.json
  skills/
    bizglance/
      SKILL.md
      scripts/
        collect-repo-context.mjs
        merge-business-findings.mjs
        validate-findings.mjs
      agents/
        business-object-agent.md
        business-flow-agent.md
        status-mutation-agent.md
        field-lineage-agent.md
        evidence-reviewer.md
        business-graph-reviewer.md
  packages/
    core/
    cli/
    web/
```

说明：

- `skills/bizglance/SKILL.md` 是 `/bizglance` 的主编排入口。
- `skills/bizglance/scripts/` 放确定性脚本，减少 agent 反复读文件。
- `skills/bizglance/agents/` 放专业 agent prompt。
- `packages/core` 保持纯契约和转换逻辑。
- `packages/cli` 保持可测试命令。
- `packages/web` 保持展示层。

## 8. 中间产物契约

推荐 `.bizglance/intermediate/` 结构：

```text
.bizglance/intermediate/
  repo-context.json
  codegraph-context.json
  business-object-findings.json
  business-flow-findings.json
  status-mutation-findings.json
  field-lineage-findings.json
  review-warnings.json
  codegraph-assisted-input.json
```

其中 `codegraph-assisted-input.json` 是稳定交给 CLI 的合成输入：

```json
{
  "codegraph": {},
  "findings": {
    "businessObjects": [],
    "flows": [],
    "statusMutations": [],
    "fieldLineages": []
  }
}
```

这个契约可以继续沿用当前实现，降低第一阶段改造成本。

## 9. Agent 输出规则

所有业务 agent 必须遵守：

- 只输出 JSON。
- 不编造文件路径、行号、route、symbol。
- 每条业务结论尽量引用 evidence。
- 没有证据但有合理推断时，置信度必须是 `low`。
- 不确定业务命名时保留技术名，并在 `description` 中解释原因。
- 不把技术依赖关系直接伪装成业务关系。
- 输出语言默认 `zh`，可由 `--language` 覆盖。

业务对象 finding 示例：

```json
{
  "technicalName": "Order",
  "name": "订单",
  "module": "交易",
  "description": "承载用户下单、支付和履约状态的核心业务对象。",
  "tags": ["transaction", "core"],
  "evidence": {
    "nodeName": "Order",
    "filePath": "src/domain/order/Order.java",
    "startLine": 12,
    "endLine": 96,
    "summary": "Order 实体包含订单号、金额、状态和用户信息。"
  }
}
```

业务流程 finding 示例：

```json
{
  "from": "Order",
  "to": "Payment",
  "relation": "creates",
  "label": "订单提交后创建支付记录",
  "confidence": "high",
  "evidence": {
    "nodeName": "OrderService.submitOrder",
    "filePath": "src/service/OrderService.java",
    "startLine": 44,
    "endLine": 71,
    "summary": "submitOrder 在校验订单后调用 paymentService.createPayment。"
  }
}
```

## 10. 推荐执行阶段

### Phase 1: 插件入口和手动 context 闭环

目标：让 `/bizglance` 可以稳定消费已有 context，跑通初始化、分析、校验和预览。

范围：

- 补齐 `.claude-plugin/plugin.json`。
- 强化 `.codex-plugin/plugin.json`。
- 保留 `--context` 调试模式。
- 文档明确当前还需要外部 context。

验收：

- `/bizglance . --context <file> --no-serve` 可生成 `.bizglance/bizglance.json`。
- `bizglance validate` 可校验最终文档。

### Phase 2: 确定性代码事实预处理

目标：把“让 LLM 自己探索仓库”改成“脚本和 CodeGraph 先给 LLM 精简上下文”。

范围：

- 新增 `collect-repo-context.mjs`。
- 新增 entrypoint/entity/status/field candidates 输出。
- 保存 `.bizglance/intermediate/repo-context.json`。

验收：

- 在没有 LLM 的情况下，可以生成稳定的代码事实 JSON。
- 输出包含 README 摘要、manifest、入口点、候选业务类、候选状态字段。

### Phase 3: 多 agent 业务 findings 生成

目标：把单一大 prompt 拆成专业 agent。

范围：

- 新增四个业务 agent prompt。
- `/bizglance` skill 编排 agent 调用。
- 每个 agent 输出独立 findings 文件。
- 新增 `merge-business-findings.mjs` 合并为 `codegraph-assisted-input.json`。

验收：

- 业务对象、流程、状态、字段血缘可以独立生成和复查。
- 任一 agent 失败时，不影响已经生成的中间产物定位问题。

### Phase 4: Reviewer 和质量闸门

目标：降低 LLM 业务理解幻觉。

范围：

- 新增 evidence reviewer。
- 新增 business graph reviewer。
- CLI validate 增加悬空引用、证据缺失、低置信度比例等检查。
- warnings 写入 `meta.warnings`。

验收：

- 编造路径或悬空对象会被拦截或降级。
- 低证据 findings 不会被标成 high confidence。

### Phase 5: 增量和复查模式

目标：接近 Understand-Anything 的实用体验。

范围：

- 记录 git commit、context hash、findings hash。
- `--review` 只复查已有图谱。
- `--full` 强制重新采集和分析。
- 后续可加 changed-files 增量分析。

验收：

- 同一 commit 下重复运行可以复用中间产物。
- 用户可以强制全量重跑。
- 用户可以只复查已有业务图谱。

## 11. 不建议第一阶段做的事

这些能力有价值，但不适合作为第一阶段主线：

- 自研完整 AST 解析引擎。
- 复制 Understand-Anything 的多语言 tree-sitter 插件系统。
- 复杂图聚类和布局算法。
- Git hook 自动更新。
- 大规模并发 agent 调度。
- 将 Web 工作台重构成完整通用图谱平台。

原因：BizGlance 当前最缺的是“业务 findings 自动生成和审查闭环”，不是更复杂的底层扫描器。

## 12. 风险与对策

### 12.1 LLM 编造业务事实

对策：

- evidence 必填或降置信度。
- reviewer 检查路径、行号、symbol 是否存在。
- Web 明确展示 confidence 和 evidence。

### 12.2 上下文太大导致成本高

对策：

- 脚本先生成 repo-context。
- CodeGraph context 限制业务相关节点。
- agent 分工，每个 agent 只拿必要上下文。

### 12.3 不同技术栈业务入口不同

对策：

- 第一阶段用通用候选规则。
- 后续逐步增加 framework hint，例如 Spring、React、Next.js、Django。
- 不把框架规则写死进 LLM prompt，优先由脚本产出候选。

### 12.4 findings 合并后关系不一致

对策：

- merge script 负责去重和 ID 归一化。
- validate 检查对象引用和 evidence 引用。
- reviewer 输出 warnings，而不是静默修复所有问题。

## 13. 成功标准

这个方向成立的标准不是“生成很多节点”，而是：

- 用户运行 `/bizglance` 后能看到业务对象和关键业务流程。
- 每个重要业务结论都能回到代码证据。
- 不确定的结论有低置信度标记。
- 失败时能定位到代码事实、agent 生成、review、assemble 或 validate 哪个阶段。
- Web 工作台展示的是业务理解，而不是代码结构噪音。

## 14. 推荐下一步

下一步建议先做 Phase 2 和 Phase 3 的设计与实施计划：

1. 设计 `skills/bizglance/agents/` 中每个 agent 的输入、输出和 prompt 边界。
2. 设计 `collect-repo-context.mjs` 的最小输出契约。
3. 设计 `merge-business-findings.mjs` 如何合并四类 findings。
4. 更新 `/bizglance` skill，让它从“要求用户提供 context”演进为“自动生成 context，允许手动覆盖”。
5. 用现有 `fixtures/codegraph/shop-context.json` 和一个真实业务仓库做验收样例。

这条路线能把 BizGlance 推向真正的 Claude Code / Codex AI 插件体验，同时保留它和 Understand-Anything 的清晰差异：BizGlance 不是通用代码地图，而是基于代码证据的业务地图。
