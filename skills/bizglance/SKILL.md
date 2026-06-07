---
name: bizglance
description: Run the BizGlance agent workflow for a local repository. Use when the user invokes /bizglance or asks Codex to initialize, analyze, validate, and preview a business knowledge graph for a codebase with BizGlance.
---

# BizGlance Agent Workflow

Use this skill to provide a single agent entry equivalent to:

```text
/bizglance [path] [--full] [--review] [--language zh] [--no-serve]
```

Keep orchestration in the agent and execution in the CLI. Use deterministic scripts for cheap repository facts, then use specialized LLM agents for business findings. Do not build a full AST engine in the first phase.

When the local CLI is available, prefer the thin orchestration command:

```bash
bizglance workflow <repo> [--context <codegraph-assisted-input.json>] [--full] [--review] [--language zh] [--no-serve]
```

This command should internally chain `bizglance init`, deterministic preprocessing, findings merge, `bizglance analyze`, `bizglance validate`, and optional `bizglance serve`.

Workflow parameter intent:

- `--full`: ignore cached `.bizglance/intermediate/codegraph-assisted-input.json`; use explicit `--context` when supplied, otherwise regenerate deterministic context and merged findings.
- `--review`: skip re-analysis and only validate or preview existing `.bizglance/bizglance.json`.
- `--language <language>`: persist the preferred output language into `.bizglance/config.json`.

## Phase 0: Pre-flight

1. Resolve the target repository path. Default to the current working directory.
2. Run `bizglance init <repo>` to create `.bizglance/`, `.bizglance/intermediate/`, `.bizglance/tmp/`, and default config files.
3. Read `.bizglance/config.json` when present.
4. Capture the current git commit when available and write it into `.bizglance/meta.json` if the implementation supports it.
5. If the path does not exist, stop and report the failing path.

## Phase 1: Deterministic Repository Facts

1. Run `skills/bizglance/scripts/collect-repo-context.mjs` to collect README summary, manifests, entrypoints, entity candidates, status candidates, and field candidates.
2. Save the output as `.bizglance/intermediate/repo-context.json`.
3. Ask CodeGraph for richer business-relevant structure facts when available: routes, controllers, services, entities, methods, fields, and key call paths.
4. Save CodeGraph facts as `.bizglance/intermediate/codegraph-context.json`. If CodeGraph is unavailable, keep the deterministic facts and continue with lower-confidence findings.

## Phase 2: LLM Business Findings

Use specialized agents instead of one large prompt:

- `business-object-agent`
- `business-flow-agent`
- `status-mutation-agent`
- `field-lineage-agent`

Each agent must generate only JSON and save its own findings file:

```text
.bizglance/intermediate/business-object-findings.json
.bizglance/intermediate/business-flow-findings.json
.bizglance/intermediate/status-mutation-findings.json
.bizglance/intermediate/field-lineage-findings.json
```

Legacy or debug runs may still use `.bizglance/intermediate/llm-findings.json` when manually assembling context.

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

Run `skills/bizglance/scripts/merge-business-findings.mjs` to merge `codegraph-context.json` and the four agent findings files into:

```text
.bizglance/intermediate/codegraph-assisted-input.json
```

Then run:

```bash
bizglance analyze <repo> --context .bizglance/intermediate/codegraph-assisted-input.json --out .bizglance/bizglance.json
```

Use `--full` to ignore cached intermediate files. Use `--review` to reuse existing BizGlance output and revalidate or preview it.

## Phase 3.5: Review

When `--review` is requested or when findings are high impact, run:

- `evidence-reviewer`
- `business-graph-reviewer`

Reviewer output should be warnings, downgrades, removals, and normalizations. Reviewers must not add new business conclusions.

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
