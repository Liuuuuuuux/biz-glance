# BizGlance

BizGlance 是一个本地代码仓库的业务视角工作台。它依赖 CodeGraph 提供代码结构、符号和证据位置，再由 LLM 归纳业务对象、业务流程、状态变更和字段血缘，最后用 Web 工作台展示出来。

## 样例演示

```powershell
pnpm install
pnpm analyze --sample education
pnpm serve
```

## 本地冒烟验收

```powershell
pnpm smoke
```

该命令会读取 `fixtures/codegraph/shop-context.json`，生成 `dist/smoke.bizglance.json`，并校验 `Product`、`Category`、业务关系、状态变更、字段血缘和代码证据是否完整。

## 一键工作流

如果已经有一份外部生成的 CodeGraph-assisted 输入 JSON，可以直接运行：

```powershell
pnpm --filter @bizglance/cli dev workflow . --context .\fixtures\codegraph\shop-context.json --no-serve
```

该命令会自动执行：

- `bizglance init`
- `bizglance analyze`
- `bizglance validate`
- 可选 `bizglance serve`

输出会写到：

```text
.bizglance/
  bizglance.json
  meta.json
  intermediate/
    codegraph-assisted-input.json
```

常用参数：

- `--full`：忽略 `.bizglance/intermediate/codegraph-assisted-input.json` 缓存，要求显式 `--context` 并重跑分析。
- `--review`：跳过重新分析，直接复查现有 `.bizglance/bizglance.json`，可配合 `--no-serve` 做静态校验。
- `--language <language>`：更新 `.bizglance/config.json` 的语言偏好，例如 `zh`、`en`。
- `--no-serve`：只生成和校验 `.bizglance/bizglance.json`，不启动 Web 工作台。

示例：

```powershell
# 强制全量重跑
pnpm --filter @bizglance/cli dev workflow . --full --context .\fixtures\codegraph\shop-context.json --language zh --no-serve

# 复查已有图谱
pnpm --filter @bizglance/cli dev workflow . --review --no-serve
```

## CodeGraph 辅助分析

`codegraph-assisted` 是当前唯一的仓库分析模式：先由外部 CodeGraph/MCP 解析本地仓库，再由 LLM 分析业务含义。BizGlance 不克隆远程仓库，也不重新解析 AST，而是读取一份外部上下文 JSON：

- `codegraph`：CodeGraph 解析得到的 nodes、edges、codeBlocks、relatedFiles、stats
- `findings`：LLM 基于 CodeGraph 上下文归纳出的业务对象、业务流、状态变化、字段血缘和证据

流程示例：

```powershell
pnpm exec codegraph init -i .\path\to\repo
pnpm exec codegraph context -p .\path\to\repo -f json -n 80 -c 24 "Analyze business objects, controllers, services, routes, and evidence" > .\.codex-runtime\codegraph-context.json

# 将 codegraph-context.json 交给 LLM，产出包含 codegraph + findings 的上下文文件
pnpm analyze .\path\to\repo -c .\.codex-runtime\codegraph-assisted-input.json
pnpm serve
```

如果要分析远程项目，请先自行 clone 到本地，再把本地路径传给 `pnpm analyze`。
