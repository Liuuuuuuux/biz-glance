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
