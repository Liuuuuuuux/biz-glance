---
name: bizglance
description: Run the BizGlance agent workflow for a local repository. Use when the user invokes /bizglance or asks Codex to initialize, analyze, validate, and preview a business knowledge graph for a codebase with BizGlance.
---

# BizGlance Agent Workflow

Use this skill to provide a single agent entry equivalent to:

```text
/bizglance [path] [--full] [--review] [--language zh] [--no-serve]
```

Keep orchestration in the agent and execution in the CLI. Do not build an AST fallback in the first phase; require CodeGraph context or stop with a clear message.

When the local CLI is available, prefer the thin orchestration command:

```bash
bizglance workflow <repo> [--context <codegraph-assisted-input.json>] [--full] [--review] [--language zh] [--no-serve]
```

This command should internally chain `bizglance init`, `bizglance analyze`, `bizglance validate`, and optional `bizglance serve`.

Workflow parameter intent:

- `--full`: ignore cached `.bizglance/intermediate/codegraph-assisted-input.json` and require explicit `--context`.
- `--review`: skip re-analysis and only validate or preview existing `.bizglance/bizglance.json`.
- `--language <language>`: persist the preferred output language into `.bizglance/config.json`.

## Phase 0: Pre-flight

1. Resolve the target repository path. Default to the current working directory.
2. Run `bizglance init <repo>` to create `.bizglance/`, `.bizglance/intermediate/`, `.bizglance/tmp/`, and default config files.
3. Read `.bizglance/config.json` when present.
4. Capture the current git commit when available and write it into `.bizglance/meta.json` if the implementation supports it.
5. If the path does not exist, stop and report the failing path.

## Phase 1: CodeGraph Context

1. Ask CodeGraph for business-relevant structure facts: routes, controllers, services, entities, methods, fields, and key call paths.
2. Save the raw context as `.bizglance/intermediate/codegraph-context.json`.
3. If CodeGraph is unavailable, stop and explain that the user must initialize CodeGraph or provide an existing context file.

## Phase 2: LLM Business Findings

Generate only JSON and save it as `.bizglance/intermediate/llm-findings.json`.

Required shape:

```json
{
  "businessObjects": [],
  "flows": [],
  "statusMutations": [],
  "fieldLineages": []
}
```

Rules:

- Do not invent file paths or line numbers.
- Mark unsupported conclusions as `low` confidence.
- Keep structure facts and business inference separate.
- Prefer the requested language, defaulting to Chinese (`zh`).
- Include evidence with `nodeName`, `filePath`, `startLine`, `endLine`, `route`, and `summary` whenever available.

## Phase 3: Assemble

Merge `codegraph-context.json` and `llm-findings.json` into:

```text
.bizglance/intermediate/codegraph-assisted-input.json
```

Then run:

```bash
bizglance analyze <repo> --context .bizglance/intermediate/codegraph-assisted-input.json --out .bizglance/bizglance.json
```

Use `--full` to ignore cached intermediate files. Use `--review` to reuse existing CodeGraph context and regenerate or revalidate business findings.

## Phase 4: Validate

Run:

```bash
bizglance validate .bizglance/bizglance.json --kind document
```

Fatal validation failures stop the workflow. Non-fatal confidence or evidence concerns should be reported as warnings and preserved in `meta.warnings` when supported.

## Phase 5: Serve

Unless the user passes `--no-serve`, run:

```bash
bizglance serve --data .bizglance/bizglance.json
```

Report the local URL. If the web preview fails, keep the generated JSON and give the manual `bizglance serve` command.

## Progress Updates

Report progress at each phase using short, concrete messages:

- `Phase 0/5: 初始化 .bizglance 工作目录`
- `Phase 1/5: 采集 CodeGraph 结构事实`
- `Phase 2/5: 归纳业务 findings`
- `Phase 3/5: 合成 BizGlance 文档`
- `Phase 4/5: 校验输出契约`
- `Phase 5/5: 启动业务工作台`
