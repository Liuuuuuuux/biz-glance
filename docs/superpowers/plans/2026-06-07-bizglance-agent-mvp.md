# BizGlance Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `/bizglance` agent workflow MVP that initializes `.bizglance/`, validates runtime contracts, and documents the agent orchestration entry.

**Architecture:** Keep orchestration in a repo-local skill document, keep CLI commands thin and testable, and keep runtime contract checks in `core`. Reuse existing `analyze`, `serve`, and smoke flows instead of adding a new analysis engine.

**Tech Stack:** TypeScript, pnpm workspaces, Commander, Vitest, Node `fs/promises`.

---

## File Structure

- Create `packages/core/src/validation.ts`: runtime validation helpers for CodeGraph-assisted input and final BizGlance documents.
- Modify `packages/core/src/index.ts`: export validation helpers.
- Create `packages/core/tests/validation.test.ts`: contract tests for valid inputs, fatal schema errors, and evidence reference checks.
- Create `packages/cli/src/commands/init.ts`: initialize `.bizglance/`, `intermediate/`, `tmp/`, default config, meta, and gitignore.
- Create `packages/cli/src/commands/validate.ts`: validate context inputs or final documents and return warnings.
- Modify `packages/cli/src/index.ts`: register `init` and `validate` commands.
- Create `packages/cli/tests/init.test.ts`: CLI init behavior tests.
- Create `packages/cli/tests/validate.test.ts`: CLI validate behavior tests.
- Create `skills/bizglance/SKILL.md`: agent workflow entry documentation for `/bizglance`.
- Create `skills/bizglance/tests/skill-content.test.ts`: text-contract test for required phases and commands.

## Task 1: Core Runtime Validation

- [ ] Write failing tests in `packages/core/tests/validation.test.ts` for `validateCodeGraphAssistedAnalysisInput`, `validateBizGlanceDocument`, and `validateBizGlanceEvidenceReferences`.
- [ ] Run `pnpm --filter @bizglance/core test packages/core/tests/validation.test.ts` and confirm failures are missing exports.
- [ ] Implement `packages/core/src/validation.ts` with simple structural checks and clear Chinese error messages.
- [ ] Export validation helpers from `packages/core/src/index.ts`.
- [ ] Run `pnpm --filter @bizglance/core test packages/core/tests/validation.test.ts` and confirm pass.

## Task 2: CLI Init Command

- [ ] Write failing tests in `packages/cli/tests/init.test.ts` for creating `.bizglance/` directories, preserving existing config, and writing default config/gitignore.
- [ ] Run `pnpm --filter @bizglance/cli test packages/cli/tests/init.test.ts` and confirm failures are missing command module.
- [ ] Implement `packages/cli/src/commands/init.ts` with injectable filesystem helpers for tests.
- [ ] Register `bizglance init [repo]` in `packages/cli/src/index.ts`.
- [ ] Run `pnpm --filter @bizglance/cli test packages/cli/tests/init.test.ts` and confirm pass.

## Task 3: CLI Validate Command

- [ ] Write failing tests in `packages/cli/tests/validate.test.ts` for valid document, invalid document, and CodeGraph-assisted context validation.
- [ ] Run `pnpm --filter @bizglance/cli test packages/cli/tests/validate.test.ts` and confirm failures are missing command module.
- [ ] Implement `packages/cli/src/commands/validate.ts` using core validation helpers.
- [ ] Register `bizglance validate <input>` with `--kind document|context|auto`.
- [ ] Run `pnpm --filter @bizglance/cli test packages/cli/tests/validate.test.ts` and confirm pass.

## Task 4: Agent Skill Entry

- [ ] Write failing test `skills/bizglance/tests/skill-content.test.ts` asserting the skill mentions `/bizglance`, CodeGraph context, LLM findings JSON, `bizglance analyze`, and `bizglance serve`.
- [ ] Run `pnpm exec vitest run skills/bizglance/tests/skill-content.test.ts` and confirm failure because the skill is absent.
- [ ] Create `skills/bizglance/SKILL.md` with pre-flight, CodeGraph, LLM findings, assemble, validate, and serve phases.
- [ ] Run the skill content test and confirm pass.

## Task 5: Integration Verification

- [ ] Run `pnpm --filter @bizglance/core test`.
- [ ] Run `pnpm --filter @bizglance/cli test`.
- [ ] Run `pnpm -r typecheck`.
- [ ] Run `pnpm smoke`.
- [ ] Summarize implemented scope, validation evidence, and any known limitations.
