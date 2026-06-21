---
name: bizglance
description: 分析本地仓库，生成业务知识图谱。使用 /bizglance 或等效命令触发。识别业务对象、业务流转、状态变更和字段血缘。
argument-hint: ["[path] [--full|--review|--language <lang>|--no-serve|--context <file>]"]
---

# /bizglance

分析目标仓库，生成 `.bizglance/bizglance.json` 业务知识图谱。通过确定性脚本采集代码事实，再调度 LLM agent 进行业务语义分析。

## 参数

- `$ARGUMENTS` 可包含：
  - 目标仓库路径（如 `/path/to/repo`），默认当前目录
  - `--full` — 忽略缓存，强制全量重新分析
  - `--review` — 跳过分析，复查已有 bizglance.json
  - `--language <lang>` — 输出语言（`zh`、`en` 等），默认 `zh`
  - `--no-serve` — 只生成 JSON，不启动 Web 工作台
  - `--context <file>` — 手动指定 codegraph-assisted-input.json（调试用）

---

## 进度报告

每个 Phase 开始时报告进度：

> `[Phase N/5] <阶段名称>...`

Phase 完成时简短确认：

> `Phase N complete. <一句话总结>`

---

## Phase 0 — Pre-flight

1. 解析 `$ARGUMENTS`，确定目标仓库路径 `$REPO_ROOT`（默认当前目录）。
2. 初始化工作目录：

```bash
pnpm --filter @bizglance/cli dev init "$REPO_ROOT"
```

3. 读取 `.bizglance/config.json`，记录语言偏好。

4. 如果 `--review` 参数存在且 `.bizglance/bizglance.json` 已存在，跳到 Phase 4。

5. 获取当前 git commit：

```bash
git -C "$REPO_ROOT" rev-parse HEAD
```

---

## Phase 1 — 确定性代码事实采集

> `[Phase 1/5] 采集代码结构事实...`

运行确定性脚本收集仓库结构：

```bash
node "<SKILL_DIR>/scripts/collect-repo-context.mjs" "$REPO_ROOT" "$REPO_ROOT/.bizglance/intermediate/repo-context.json"
```

读取产出文件：

- `$REPO_ROOT/.bizglance/intermediate/repo-context.json` — entityCandidates, entrypoints, readme, stats

基于 repo-context.json 生成 codegraph-context.json：

```bash
cat > "$REPO_ROOT/.bizglance/intermediate/codegraph-context.json" << 'ENDJSON'
{
  "query": "BizGlance deterministic repository preprocessor",
  "summary": "<从 repo-context.json 的 readme.summary 提取>",
  "nodes": [
    <将 entityCandidates 和 entrypoints 转为 {kind, name, filePath, startLine, endLine} 格式>
  ],
  "edges": [],
  "codeBlocks": [],
  "relatedFiles": [<所有引用文件路径去重>],
  "stats": {
    "nodeCount": <节点数>,
    "edgeCount": 0,
    "fileCount": <repo-context.json 的 stats.fileCount>,
    "codeBlockCount": 0,
    "totalCodeSize": 0
  }
}
ENDJSON
```

> Phase 1 complete. 识别到 <N> 个 entity candidates，<M> 个 entrypoints。

---

## Phase 2 — LLM 业务分析

> `[Phase 2/5] 调度 LLM agent 分析业务语义...`

这是核心阶段。调度 4 个专业 agent 进行业务分析。

**重要**：每个 agent 是一个独立的 subagent，通过 Agent tool 调度。它们读取 Phase 1 的产出文件和源代码，写入各自的 findings 文件。

### 2.1 business-object-agent

调度 business-object-agent 识别业务对象。

Agent 定义文件：`<SKILL_DIR>/agents/business-object-agent.md`

Dispatch prompt：

> 分析 `$REPO_ROOT` 中的仓库，识别真正的业务对象。
>
> 项目根目录：`$REPO_ROOT`
> 中间文件目录：`$REPO_ROOT/.bizglance/intermediate/`
>
> 先读取 `.bizglance/intermediate/repo-context.json` 和 `.bizglance/intermediate/codegraph-context.json` 了解仓库结构。
> 然后读取 entityCandidates 中引用的源文件（特别是 model/、entity/、domain/ 包下的类），获取字段定义和注解信息。
>
> 排除测试类、配置类、工具类，只保留真正的业务领域对象。
> 为每个业务对象提供中文业务名、模块归属和有意义的描述。
>
> 将结果写入 `.bizglance/intermediate/business-object-findings.json`。

### 2.2 business-flow-agent

调度 business-flow-agent 识别业务流转关系。

Agent 定义文件：`<SKILL_DIR>/agents/business-flow-agent.md`

Dispatch prompt：

> 分析 `$REPO_ROOT` 中的仓库，识别业务对象之间的流转关系。
>
> 项目根目录：`$REPO_ROOT`
> 中间文件目录：`$REPO_ROOT/.bizglance/intermediate/`
>
> 先读取 `.bizglance/intermediate/business-object-findings.json` 了解已识别的业务对象。
> 然后读取 Controller 和 Service 源文件，分析方法中的对象创建、更新和引用关系。
>
> 只识别有业务意义的关系（creates/updates/references），不把技术依赖当业务关系。
> 每条关系必须引用已有的业务对象。
>
> 将结果写入 `.bizglance/intermediate/business-flow-findings.json`。

### 2.3 status-mutation-agent

调度 status-mutation-agent 识别状态变更。

Agent 定义文件：`<SKILL_DIR>/agents/status-mutation-agent.md`

Dispatch prompt：

> 分析 `$REPO_ROOT` 中的仓库，识别业务对象中的状态字段和状态转换。
>
> 项目根目录：`$REPO_ROOT`
> 中间文件目录：`$REPO_ROOT/.bizglance/intermediate/`
>
> 先读取 `.bizglance/intermediate/business-object-findings.json`。
> 然后读取实体类和相关服务类源文件，查找状态字段（如 status、state）和修改这些字段的方法。
>
> 只在有实际代码证据时才生成 finding，不从枚举名推断。
>
> 将结果写入 `.bizglance/intermediate/status-mutation-findings.json`。

### 2.4 field-lineage-agent

调度 field-lineage-agent 识别字段血缘。

Agent 定义文件：`<SKILL_DIR>/agents/field-lineage-agent.md`

Dispatch prompt：

> 分析 `$REPO_ROOT` 中的仓库，识别业务对象的字段来源和计算关系。
>
> 项目根目录：`$REPO_ROOT`
> 中间文件目录：`$REPO_ROOT/.bizglance/intermediate/`
>
> 先读取 `.bizglance/intermediate/business-object-findings.json`。
> 然后读取实体类和 DTO 类源文件，分析字段的关联、映射和计算关系。
>
> 只在代码中有明确证据时生成 finding。
>
> 将结果写入 `.bizglance/intermediate/field-lineage-findings.json`。

### 并行调度

以上 4 个 agent **可以并行调度**（使用 Agent tool 的并行调用能力）。business-object-agent 建议先完成，其他 3 个可以同时运行。

> Phase 2 complete. 业务对象 <N> 个，流转 <M> 条，状态变更 <P> 个，字段血缘 <Q> 条。

---

## Phase 3 — 合成

> `[Phase 3/5] 合成 BizGlance 文档...`

### 3.1 确定性审查

运行 findings 审查脚本：

```bash
node "<SKILL_DIR>/scripts/validate-findings.mjs" "$REPO_ROOT/.bizglance/intermediate"
```

### 3.2 合并 findings

运行合并脚本：

```bash
node "<SKILL_DIR>/scripts/merge-business-findings.mjs" "$REPO_ROOT/.bizglance/intermediate" "$REPO_ROOT/.bizglance/intermediate/codegraph-assisted-input.json"
```

### 3.3 生成 BizGlance 文档

运行 CLI analyze 命令：

```bash
pnpm --filter @bizglance/cli dev analyze "$REPO_ROOT" --context "$REPO_ROOT/.bizglance/intermediate/codegraph-assisted-input.json" --out "$REPO_ROOT/.bizglance/bizglance.json" --lens codegraph-assisted
```

### 3.4 校验文档

```bash
pnpm --filter @bizglance/cli dev validate "$REPO_ROOT/.bizglance/bizglance.json" --kind document
```

如果校验失败，停止并报告错误。

> Phase 3 complete. BizGlance 文档已生成。

---

## Phase 4 — Reviewer 审查

> `[Phase 4/5] 审查业务图谱质量...`

如果 `--review` 参数存在，或者 Phase 2 的 findings 看起来需要审查（例如缺少 evidence），调度审查 agent：

### evidence-reviewer

Agent 定义文件：`<SKILL_DIR>/agents/evidence-reviewer.md`

Dispatch prompt：

> 审查 `$REPO_ROOT/.bizglance/intermediate/` 下所有 findings 文件的证据质量。
> 读取 codegraph-context.json 和所有 *-findings.json，检查路径、行号和符号引用的真实性。
> 将审查结果写入 `$REPO_ROOT/.bizglance/intermediate/review-warnings.json`。

### business-graph-reviewer

Agent 定义文件：`<SKILL_DIR>/agents/business-graph-reviewer.md`

Dispatch prompt：

> 审查 `$REPO_ROOT/.bizglance/intermediate/` 下所有 findings 文件的一致性。
> 检查重复对象、悬空引用和置信度问题。
> 将审查结果追加到 `$REPO_ROOT/.bizglance/intermediate/review-warnings.json`。

审查完成后，如果有 warnings，重新运行 Phase 3 的合并和生成步骤以应用 downgrades。

> Phase 4 complete. 审查发现 <N> 条 warnings。

---

## Phase 5 — 启动工作台

如果 `$ARGUMENTS` 不包含 `--no-serve`：

> `[Phase 5/5] 启动业务工作台...`

```bash
pnpm --filter @bizglance/cli dev serve --data "$REPO_ROOT/.bizglance/bizglance.json"
```

报告预览 URL。

> Phase 5 complete. 业务工作台已启动：<URL>

如果包含 `--no-serve`，跳过此步并报告 `.bizglance/bizglance.json` 的路径。

---

## 手动 Context 模式

如果 `$ARGUMENTS` 包含 `--context <file>`，跳过 Phase 1 和 Phase 2，直接使用指定的 context 文件：

```bash
pnpm --filter @bizglance/cli dev analyze "$REPO_ROOT" --context "<file>" --out "$REPO_ROOT/.bizglance/bizglance.json"
```

然后继续 Phase 3.4 → Phase 4 → Phase 5。
