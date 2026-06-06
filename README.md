# BizGlance

## 样例演示

```powershell
pnpm install
pnpm --filter @bizglance/cli dev analyze --sample education --out .\dist\education.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\education.bizglance.json
```

## 本地冒烟验收

```powershell
pnpm smoke
```

该命令会分析 `fixtures/java-spring-mini`，生成 `dist/smoke.bizglance.json`，并校验 `PurchaseOrder`、`ReceiptOrder`、创建关系、状态变更、字段血缘和代码证据是否完整。

## 本地 Java/Spring 演示

```powershell
pnpm --filter @bizglance/cli dev analyze --repo .\fixtures\java-spring-mini --lens java-spring --out .\dist\java-mini.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\java-mini.bizglance.json
```

## GitHub 真实项目演示

`--repo` 也可以传入公开 GitHub 仓库地址。CLI 会优先浅克隆到临时目录；如果网络导致 clone 失败，会自动尝试下载 GitHub archive，再复用 Java/Spring 分析器生成统一的 `bizglance.json`。

```powershell
pnpm --filter @bizglance/cli dev analyze --repo https://github.com/<owner>/<repo> --lens java-spring --out .\dist\github.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\github.bizglance.json
```

已验证的真实业务项目示例：

```powershell
pnpm --filter @bizglance/cli dev analyze --repo https://github.com/syqu22/spring-boot-shop-sample --lens java-spring --out .\dist\shop-sample.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\shop-sample.bizglance.json
```

这份电商项目分析会识别 `Category`、`Product`、`User` 等业务对象，并在工作台中展示 `/product/edit/{id}`、`/register` 等真实代码证据。

## CodeGraph 辅助分析

`codegraph-assisted` lens 用于“先由外部 CodeGraph/MCP 解析代码，再由 LLM 分析业务含义”的流程。BizGlance 不在这一模式里重新解析 AST，而是读取一份外部上下文 JSON：

- `codegraph`：CodeGraph 解析得到的 nodes、edges、codeBlocks、relatedFiles、stats
- `findings`：LLM 基于 CodeGraph 上下文归纳出的业务对象、业务流、状态变化、字段血缘和证据

流程示例：

```powershell
pnpm exec codegraph init -i .\path\to\repo
pnpm exec codegraph context -p .\path\to\repo -f json -n 80 -c 24 "Analyze business objects, controllers, services, routes, and evidence" > .\.codex-runtime\codegraph-context.json

# 将 codegraph-context.json 交给 LLM，产出包含 codegraph + findings 的上下文文件
pnpm --filter @bizglance/cli dev analyze --repo https://github.com/syqu22/spring-boot-shop-sample --lens codegraph-assisted --codegraph-context .\.codex-runtime\spring-shop-codegraph-assisted-input.json --out .\dist\spring-shop-codegraph.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\spring-shop-codegraph.bizglance.json
```

本地已用真实 GitHub 项目 `syqu22/spring-boot-shop-sample` 验证该流程：CodeGraph 索引识别 49 个文件、751 个节点、1340 条边，最终结果包含 `Product`、`Category`、`User`、`ShoppingCart` 及商品管理、购物车、注册登录等业务证据。
