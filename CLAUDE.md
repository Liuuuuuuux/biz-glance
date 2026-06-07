# BizGlance Claude Code Guide

BizGlance 提供一个面向业务知识图谱的本地分析入口，推荐优先使用 `/bizglance` 或底层 CLI 的 `bizglance workflow`。

## 推荐入口

代理入口目标形态：

```text
/bizglance [path] [--full] [--review] [--language zh] [--no-serve]
```

当前仓库内可直接执行的 CLI 入口：

```powershell
pnpm --filter @bizglance/cli dev workflow . --context .\fixtures\codegraph\shop-context.json --no-serve
```

## Workflow 参数

- `--full`：忽略 `.bizglance/intermediate/codegraph-assisted-input.json` 缓存，要求显式 `--context` 并重跑分析。
- `--review`：跳过重新分析，直接复查现有 `.bizglance/bizglance.json` 并按需预览。
- `--language <language>`：写入 `.bizglance/config.json` 的语言偏好，例如 `zh` 或 `en`。
- `--no-serve`：只生成和校验 `.bizglance/bizglance.json`，不启动 Web 工作台。

## 典型命令

首次分析本地仓库：

```powershell
pnpm --filter @bizglance/cli dev workflow . --context .\fixtures\codegraph\shop-context.json --language zh
```

基于已有图谱做复查：

```powershell
pnpm --filter @bizglance/cli dev workflow . --review --no-serve
```

强制全量重跑：

```powershell
pnpm --filter @bizglance/cli dev workflow . --full --context .\fixtures\codegraph\shop-context.json --no-serve
```
