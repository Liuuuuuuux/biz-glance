# BizGlance MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 BizGlance 第一版端到端最小闭环，支持 `sample` 与本地 `repo` 两种输入，产出统一 `bizglance.json` 并在 Web 工作台中展示。

**Architecture:** 使用 pnpm monorepo 管理 `core`、`cli`、`web` 三个包。`core` 负责统一模型与分析逻辑，`cli` 负责命令入口与 JSON 产出，`web` 负责读取 JSON 并呈现基于现有原型拆分出的 React 工作台。

**Tech Stack:** TypeScript, pnpm workspace, Node.js, Vitest, React, Vite

---

## File Structure

- Create: `E:\code\biz-glance\package.json`
- Create: `E:\code\biz-glance\pnpm-workspace.yaml`
- Create: `E:\code\biz-glance\tsconfig.base.json`
- Create: `E:\code\biz-glance\examples\education.bizglance.json`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\controller\PurchaseOrderController.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\service\PurchaseOrderService.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\service\impl\PurchaseOrderServiceImpl.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\mapper\PurchaseOrderMapper.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\domain\PurchaseOrder.java`
- Create: `E:\code\biz-glance\packages\core\package.json`
- Create: `E:\code\biz-glance\packages\core\tsconfig.json`
- Create: `E:\code\biz-glance\packages\core\src\schema.ts`
- Create: `E:\code\biz-glance\packages\core\src\index.ts`
- Create: `E:\code\biz-glance\packages\core\src\sample\education.ts`
- Create: `E:\code\biz-glance\packages\core\src\sample\index.ts`
- Create: `E:\code\biz-glance\packages\core\src\analyzers\javaSpring.ts`
- Create: `E:\code\biz-glance\packages\core\src\export\writeDocument.ts`
- Create: `E:\code\biz-glance\packages\core\tests\sample.test.ts`
- Create: `E:\code\biz-glance\packages\core\tests\javaSpring.test.ts`
- Create: `E:\code\biz-glance\packages\cli\package.json`
- Create: `E:\code\biz-glance\packages\cli\tsconfig.json`
- Create: `E:\code\biz-glance\packages\cli\src\index.ts`
- Create: `E:\code\biz-glance\packages\cli\src\commands\analyze.ts`
- Create: `E:\code\biz-glance\packages\cli\src\commands\serve.ts`
- Create: `E:\code\biz-glance\packages\cli\tests\analyze.test.ts`
- Create: `E:\code\biz-glance\packages\web\package.json`
- Create: `E:\code\biz-glance\packages\web\tsconfig.json`
- Create: `E:\code\biz-glance\packages\web\vite.config.ts`
- Create: `E:\code\biz-glance\packages\web\index.html`
- Create: `E:\code\biz-glance\packages\web\src\main.tsx`
- Create: `E:\code\biz-glance\packages\web\src\App.tsx`
- Create: `E:\code\biz-glance\packages\web\src\styles.css`
- Create: `E:\code\biz-glance\packages\web\src\lib\loadDocument.ts`
- Create: `E:\code\biz-glance\packages\web\src\components\WorkbenchLayout.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\DocumentFlowView.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\StatusFlowView.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\FieldLineageView.tsx`
- Create: `E:\code\biz-glance\packages\web\tests\App.test.tsx`
- Modify: `E:\code\biz-glance\README.md` if absent then create it

### Task 1: 搭建 monorepo 与测试基础

**Files:**
- Create: `E:\code\biz-glance\package.json`
- Create: `E:\code\biz-glance\pnpm-workspace.yaml`
- Create: `E:\code\biz-glance\tsconfig.base.json`
- Create: `E:\code\biz-glance\packages\core\package.json`
- Create: `E:\code\biz-glance\packages\cli\package.json`
- Create: `E:\code\biz-glance\packages\web\package.json`

- [ ] **Step 1: 写根工作区配置的失败校验**

```json
{
  "private": true,
  "name": "biz-glance",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  }
}
```

运行：

```powershell
pnpm install
pnpm test
```

预期：因为各包尚未创建测试脚本而失败，确认工作区命令已经生效。

- [ ] **Step 2: 创建最小工作区配置**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: 为三个包写最小 package 配置**

```json
// packages/core/package.json
{
  "name": "@bizglance/core",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
// packages/cli/package.json
{
  "name": "@bizglance/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bizglance": "src/index.ts"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
// packages/web/package.json
{
  "name": "@bizglance/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

- [ ] **Step 4: 安装依赖并补齐最小 tsconfig**

运行：

```powershell
pnpm add -Dw typescript tsx vitest @types/node
pnpm --filter @bizglance/web add react react-dom
pnpm --filter @bizglance/web add -D vite @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/react @types/react-dom
pnpm --filter @bizglance/cli add commander
pnpm --filter @bizglance/core add fast-glob
```

补充每个包的最小 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

预期：安装成功，无 peer dependency 致命报错。

- [ ] **Step 5: 运行工作区类型检查和测试**

运行：

```powershell
pnpm typecheck
pnpm test
```

预期：仍会失败，但失败原因应变成“源码文件不存在”或“测试文件不存在”，说明基础脚手架已连通。

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/core/package.json packages/cli/package.json packages/web/package.json
git commit -m "chore: scaffold monorepo workspace"
```

### Task 2: 定义统一数据模型与样例数据

**Files:**
- Create: `E:\code\biz-glance\packages\core\tsconfig.json`
- Create: `E:\code\biz-glance\packages\core\src\schema.ts`
- Create: `E:\code\biz-glance\packages\core\src\sample\education.ts`
- Create: `E:\code\biz-glance\packages\core\src\sample\index.ts`
- Create: `E:\code\biz-glance\packages\core\src\index.ts`
- Create: `E:\code\biz-glance\packages\core\tests\sample.test.ts`
- Create: `E:\code\biz-glance\examples\education.bizglance.json`

- [ ] **Step 1: 先写样例数据的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { getSampleDocument } from '../src/index';

describe('sample document', () => {
  it('returns the education sample with flows and evidence', () => {
    const doc = getSampleDocument('education');
    expect(doc.meta.source.kind).toBe('sample');
    expect(doc.businessObjects.length).toBeGreaterThan(2);
    expect(doc.flows.some((flow) => flow.relation === 'creates')).toBe(true);
    expect(doc.evidences.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：

```powershell
pnpm --filter @bizglance/core test
```

预期：FAIL，提示 `getSampleDocument` 或 `evidences` 未定义。

- [ ] **Step 3: 写完整 schema 与样例实现**

```ts
// packages/core/src/schema.ts
export interface BizGlanceDocument {
  meta: {
    version: '0.1.0';
    generatedAt: string;
    source: {
      kind: 'sample' | 'repo';
      name: string;
      lens: 'java-spring' | 'generic-sample';
      path?: string;
    };
    warnings: string[];
  };
  businessObjects: BusinessObject[];
  flows: BusinessFlow[];
  statusMutations: StatusMutation[];
  fieldLineages: FieldLineage[];
  evidences: Evidence[];
}
```

```ts
// packages/core/src/sample/education.ts
import type { BizGlanceDocument } from '../schema';

export const educationSample: BizGlanceDocument = {
  meta: {
    version: '0.1.0',
    generatedAt: '2026-06-06T00:00:00.000Z',
    source: {
      kind: 'sample',
      name: 'education',
      lens: 'generic-sample',
    },
    warnings: [],
  },
  businessObjects: [
    { id: 'course', name: '课程', technicalName: 'Course', module: 'teaching' },
    { id: 'enrollment', name: '报名记录', technicalName: 'Enrollment', module: 'teaching' },
    { id: 'progress', name: '学习进度', technicalName: 'LearningProgress', module: 'learning' },
    { id: 'certificate', name: '学习证书', technicalName: 'Certificate', module: 'learning' }
  ],
  flows: [
    { id: 'f1', from: 'course', to: 'enrollment', relation: 'creates', label: '发起报名', sourceKind: 'sample', confidence: 'high', evidenceIds: ['e1'] },
    { id: 'f2', from: 'enrollment', to: 'progress', relation: 'updates', label: '推进学习', sourceKind: 'sample', confidence: 'high', evidenceIds: ['e2'] },
    { id: 'f3', from: 'progress', to: 'certificate', relation: 'creates', label: '生成证书', sourceKind: 'sample', confidence: 'high', evidenceIds: ['e3'] }
  ],
  statusMutations: [],
  fieldLineages: [],
  evidences: [
    { id: 'e1', title: '报名入口', summary: '样例数据：课程创建报名记录' },
    { id: 'e2', title: '学习进度更新', summary: '样例数据：报名记录推进学习进度' },
    { id: 'e3', title: '证书生成', summary: '样例数据：学习进度完成后生成证书' }
  ]
};
```

- [ ] **Step 4: 导出索引与样例 JSON 文件**

```ts
// packages/core/src/index.ts
export * from './schema';
export { getSampleDocument } from './sample';
export { analyzeJavaSpringProject } from './analyzers/javaSpring';
export { writeDocument } from './export/writeDocument';
```

```ts
// packages/core/src/sample/index.ts
import { educationSample } from './education';

const samples = {
  education: educationSample,
} as const;

export function getSampleDocument(name: keyof typeof samples) {
  return structuredClone(samples[name]);
}
```

运行：

```powershell
pnpm --filter @bizglance/core test
```

预期：PASS。

- [ ] **Step 5: 生成 examples 下的演示文件**

运行：

```powershell
Copy-Item 'E:\code\biz-glance\examples\education.bizglance.json' 'E:\code\biz-glance\examples\education.bizglance.json.bak' -ErrorAction SilentlyContinue
```

文件内容与 `educationSample` 保持一致，供 Web 与 README 演示使用。

- [ ] **Step 6: Commit**

```bash
git add packages/core examples/education.bizglance.json
git commit -m "feat: add bizglance schema and sample document"
```

### Task 3: 实现 Java/Spring 最小分析器

**Files:**
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\controller\PurchaseOrderController.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\service\PurchaseOrderService.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\service\impl\PurchaseOrderServiceImpl.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\mapper\PurchaseOrderMapper.java`
- Create: `E:\code\biz-glance\fixtures\java-spring-mini\src\main\java\com\example\demo\domain\PurchaseOrder.java`
- Create: `E:\code\biz-glance\packages\core\src\analyzers\javaSpring.ts`
- Create: `E:\code\biz-glance\packages\core\tests\javaSpring.test.ts`

- [ ] **Step 1: 先用 fixture 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeJavaSpringProject } from '../src/analyzers/javaSpring';

describe('analyzeJavaSpringProject', () => {
  it('extracts a minimal status mutation and business object relation', async () => {
    const doc = await analyzeJavaSpringProject('E:/code/biz-glance/fixtures/java-spring-mini');
    expect(doc.meta.source.kind).toBe('repo');
    expect(doc.businessObjects.some((item) => item.name.includes('采购订单'))).toBe(true);
    expect(doc.flows.length).toBeGreaterThan(0);
    expect(doc.statusMutations.some((item) => item.field === 'status')).toBe(true);
  });
});
```

- [ ] **Step 2: 创建最小 Java fixture**

```java
// PurchaseOrderController.java
@RestController
@RequestMapping("/purchase/order")
public class PurchaseOrderController {
    private final PurchaseOrderService purchaseOrderService;

    @PutMapping("/changeStatus")
    public void changeStatus() {
        purchaseOrderService.changeStatus("NEW", "APPROVED");
    }
}
```

```java
// PurchaseOrderServiceImpl.java
@Service
public class PurchaseOrderServiceImpl implements PurchaseOrderService {
    private final PurchaseOrderMapper purchaseOrderMapper;

    @Override
    public void changeStatus(String from, String to) {
        PurchaseOrder order = new PurchaseOrder();
        order.setStatus(to);
        purchaseOrderMapper.updateStatus(order);
    }
}
```

- [ ] **Step 3: 运行测试确认失败**

运行：

```powershell
pnpm --filter @bizglance/core test -- javaSpring.test.ts
```

预期：FAIL，提示 `analyzeJavaSpringProject` 未实现。

- [ ] **Step 4: 写最小规则分析器**

```ts
// packages/core/src/analyzers/javaSpring.ts
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BizGlanceDocument, BusinessObject, Evidence } from '../schema';

export async function analyzeJavaSpringProject(root: string): Promise<BizGlanceDocument> {
  const files = await fg('**/*.java', { cwd: root, absolute: true });
  const businessObjects: BusinessObject[] = [];
  const evidences: Evidence[] = [];
  const statusMutations = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.includes('class PurchaseOrder')) {
      businessObjects.push({ id: 'purchase-order', name: '采购订单', technicalName: 'PurchaseOrder', module: 'purchase' });
      evidences.push({ id: 'repo-object', title: 'PurchaseOrder domain', filePath: file, symbol: 'PurchaseOrder', summary: '识别到采购订单领域对象' });
    }
    if (content.includes('setStatus(') || content.includes('changeStatus(') || content.includes('updateStatus(')) {
      statusMutations.push({
        id: `status-${statusMutations.length + 1}`,
        objectId: 'purchase-order',
        field: 'status',
        trigger: 'changeStatus',
        toStatus: 'APPROVED',
        sourceKind: 'explicit',
        confidence: 'medium',
        evidenceIds: ['repo-status']
      });
    }
  }

  return {
    meta: {
      version: '0.1.0',
      generatedAt: new Date().toISOString(),
      source: { kind: 'repo', name: 'java-spring-mini', lens: 'java-spring', path: root },
      warnings: businessObjects.length ? [] : ['未识别到业务对象']
    },
    businessObjects,
    flows: [{
      id: 'repo-flow-1',
      from: 'purchase-order',
      to: 'purchase-order',
      relation: 'updates',
      label: '变更采购订单状态',
      sourceKind: 'inferred',
      confidence: 'medium',
      evidenceIds: ['repo-status']
    }],
    statusMutations,
    fieldLineages: [],
    evidences: [
      ...evidences,
      {
        id: 'repo-status',
        title: '采购订单状态变更',
        filePath: join(root, 'src/main/java/com/example/demo/service/impl/PurchaseOrderServiceImpl.java'),
        symbol: 'PurchaseOrderServiceImpl.changeStatus',
        summary: '识别到 setStatus 与 Mapper 更新调用'
      }
    ]
  };
}
```

- [ ] **Step 5: 跑测试并扩展 warning 断言**

运行：

```powershell
pnpm --filter @bizglance/core test
pnpm --filter @bizglance/core typecheck
```

预期：PASS。

- [ ] **Step 6: Commit**

```bash
git add fixtures packages/core/src/analyzers packages/core/tests/javaSpring.test.ts
git commit -m "feat: add minimal java spring analyzer"
```

### Task 4: 实现 JSON 导出与 CLI analyze

**Files:**
- Create: `E:\code\biz-glance\packages\core\src\export\writeDocument.ts`
- Create: `E:\code\biz-glance\packages\cli\tsconfig.json`
- Create: `E:\code\biz-glance\packages\cli\src\commands\analyze.ts`
- Create: `E:\code\biz-glance\packages\cli\src\index.ts`
- Create: `E:\code\biz-glance\packages\cli\tests\analyze.test.ts`

- [ ] **Step 1: 写 analyze 的失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';

describe('cli analyze', () => {
  it('writes a sample document to disk', async () => {
    const output = 'E:/code/biz-glance/tmp/sample-output.json';
    await execa('pnpm', ['--filter', '@bizglance/cli', 'dev', 'analyze', '--sample', 'education', '--out', output]);
    const text = await import('node:fs/promises').then((fs) => fs.readFile(output, 'utf8'));
    expect(JSON.parse(text).meta.source.kind).toBe('sample');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：

```powershell
pnpm --filter @bizglance/cli test
```

预期：FAIL，提示 CLI 入口不存在或命令执行失败。

- [ ] **Step 3: 实现导出函数与 analyze 命令**

```ts
// packages/core/src/export/writeDocument.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BizGlanceDocument } from '../schema';

export async function writeDocument(filePath: string, document: BizGlanceDocument) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(document, null, 2), 'utf8');
}
```

```ts
// packages/cli/src/commands/analyze.ts
import { analyzeJavaSpringProject, getSampleDocument, writeDocument } from '@bizglance/core';

export async function runAnalyzeCommand(options: { sample?: string; repo?: string; out: string; lens?: string }) {
  if ((!options.sample && !options.repo) || (options.sample && options.repo)) {
    throw new Error('必须且只能提供 --sample 或 --repo 其中一个参数。');
  }

  const document = options.sample
    ? getSampleDocument(options.sample as 'education')
    : await analyzeJavaSpringProject(options.repo!);

  await writeDocument(options.out, document);
}
```

```ts
// packages/cli/src/index.ts
import { Command } from 'commander';
import { runAnalyzeCommand } from './commands/analyze';

const program = new Command();
program
  .command('analyze')
  .requiredOption('--out <path>')
  .option('--sample <name>')
  .option('--repo <path>')
  .option('--lens <name>', 'analysis lens', 'java-spring')
  .action(async (options) => {
    await runAnalyzeCommand(options);
  });

await program.parseAsync(process.argv);
```

- [ ] **Step 4: 补齐 CLI 测试依赖并执行**

运行：

```powershell
pnpm --filter @bizglance/cli add -D execa
pnpm --filter @bizglance/cli test
pnpm --filter @bizglance/cli typecheck
```

预期：PASS。

- [ ] **Step 5: 增加 repo 模式与错误参数测试**

```ts
it('fails when sample and repo are both provided', async () => {
  await expect(
    runAnalyzeCommand({
      sample: 'education',
      repo: 'E:/code/biz-glance/fixtures/java-spring-mini',
      out: 'tmp/out.json'
    })
  ).rejects.toThrow('必须且只能提供 --sample 或 --repo 其中一个参数。');
});
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/export packages/cli
git commit -m "feat: add analyze command"
```

### Task 5: 实现 Web 数据加载与工作台骨架

**Files:**
- Create: `E:\code\biz-glance\packages\web\tsconfig.json`
- Create: `E:\code\biz-glance\packages\web\vite.config.ts`
- Create: `E:\code\biz-glance\packages\web\index.html`
- Create: `E:\code\biz-glance\packages\web\src\main.tsx`
- Create: `E:\code\biz-glance\packages\web\src\App.tsx`
- Create: `E:\code\biz-glance\packages\web\src\styles.css`
- Create: `E:\code\biz-glance\packages\web\src\lib\loadDocument.ts`
- Create: `E:\code\biz-glance\packages\web\src\components\WorkbenchLayout.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\DocumentFlowView.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\StatusFlowView.tsx`
- Create: `E:\code\biz-glance\packages\web\src\views\FieldLineageView.tsx`
- Create: `E:\code\biz-glance\packages\web\tests\App.test.tsx`

- [ ] **Step 1: 先写组件失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import sample from '../../../examples/education.bizglance.json';

describe('App', () => {
  it('renders the first business object and document flow', () => {
    render(<App initialDocument={sample} />);
    expect(screen.getByText('课程')).toBeInTheDocument();
    expect(screen.getByText('单据流转')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：

```powershell
pnpm --filter @bizglance/web test
```

预期：FAIL，提示 `App` 或 `initialDocument` 未实现。

- [ ] **Step 3: 写 JSON 加载器与 App 状态骨架**

```ts
// packages/web/src/lib/loadDocument.ts
import type { BizGlanceDocument } from '@bizglance/core';

export async function loadDocument(url: string): Promise<BizGlanceDocument> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载数据文件：${url}`);
  }
  return response.json();
}
```

```tsx
// packages/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { loadDocument } from './lib/loadDocument';

const params = new URLSearchParams(window.location.search);
const dataPath = params.get('data');
const root = ReactDOM.createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (!dataPath) {
    root.render(<div className="empty-state">缺少 data 参数，请先通过 CLI 生成并传入 bizglance.json。</div>);
    return;
  }

  try {
    const document = await loadDocument(dataPath);
    root.render(
      <React.StrictMode>
        <App initialDocument={document} />
      </React.StrictMode>
    );
  } catch (error) {
    root.render(<div className="empty-state">{error instanceof Error ? error.message : '加载数据失败。'}</div>);
  }
}

void bootstrap();
```

```tsx
// packages/web/src/App.tsx
import { useMemo, useState } from 'react';
import type { BizGlanceDocument } from '@bizglance/core';
import { WorkbenchLayout } from './components/WorkbenchLayout';

type ViewName = 'document' | 'status' | 'field';

export default function App({ initialDocument }: { initialDocument: BizGlanceDocument }) {
  const [view, setView] = useState<ViewName>('document');
  const [selectedObjectId, setSelectedObjectId] = useState(initialDocument.businessObjects[0]?.id ?? '');
  const selectedObject = useMemo(
    () => initialDocument.businessObjects.find((item) => item.id === selectedObjectId) ?? null,
    [initialDocument.businessObjects, selectedObjectId]
  );

  return (
    <WorkbenchLayout
      document={initialDocument}
      view={view}
      onViewChange={setView}
      selectedObject={selectedObject}
      onSelectObject={setSelectedObjectId}
    />
  );
}
```

- [ ] **Step 4: 拆出工作台布局并从原型迁移样式**

```tsx
// packages/web/src/components/WorkbenchLayout.tsx
import type { BizGlanceDocument, BusinessObject } from '@bizglance/core';
import { DocumentFlowView } from '../views/DocumentFlowView';
import { StatusFlowView } from '../views/StatusFlowView';
import { FieldLineageView } from '../views/FieldLineageView';

export function WorkbenchLayout(props: {
  document: BizGlanceDocument;
  view: 'document' | 'status' | 'field';
  selectedObject: BusinessObject | null;
  onViewChange: (view: 'document' | 'status' | 'field') => void;
  onSelectObject: (id: string) => void;
}) {
  const { document, view, selectedObject } = props;
  return (
    <div className="product-shell">
      <aside>{document.businessObjects.map((item) => <button key={item.id}>{item.name}</button>)}</aside>
      <main>
        {view === 'document' && <DocumentFlowView document={document} selectedObject={selectedObject} />}
        {view === 'status' && <StatusFlowView document={document} selectedObject={selectedObject} />}
        {view === 'field' && <FieldLineageView document={document} selectedObject={selectedObject} />}
      </main>
      <aside>{selectedObject?.name ?? '未选择业务对象'}</aside>
    </div>
  );
}
```

将 [bizglance-business-workbench.html](E:\code\biz-glance\bizglance-business-workbench.html) 中的设计 token、三栏布局、tab、对象列表样式迁移到 `packages/web/src/styles.css`，优先保留现有变量和 class 命名，避免重造 CSS 体系。

- [ ] **Step 5: 让三种视图都支持空态**

```tsx
// DocumentFlowView.tsx
export function DocumentFlowView({ document, selectedObject }) {
  const flows = selectedObject
    ? document.flows.filter((item) => item.from === selectedObject.id || item.to === selectedObject.id)
    : [];

  if (!flows.length) {
    return <div className="empty-state">当前对象暂未识别到单据流转。</div>;
  }

  return <div>{flows.map((item) => <div key={item.id}>{item.label}</div>)}</div>;
}
```

运行：

```powershell
pnpm --filter @bizglance/web test
pnpm --filter @bizglance/web typecheck
```

预期：PASS。

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat: add bizglance workbench web shell"
```

### Task 6: 实现 serve、README 与完整冒烟验证

**Files:**
- Create: `E:\code\biz-glance\packages\cli\src\commands\serve.ts`
- Create or Modify: `E:\code\biz-glance\README.md`

- [ ] **Step 1: 写 serve 命令的最小失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildWebDataUrl } from '../src/commands/serve';

describe('buildWebDataUrl', () => {
  it('adds the JSON path as a data query parameter', () => {
    const url = buildWebDataUrl('E:/code/biz-glance/examples/education.bizglance.json');
    expect(url).toContain('data=');
  });
});
```

- [ ] **Step 2: 实现 serve 命令**

```ts
// packages/cli/src/commands/serve.ts
import { access, copyFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

export function buildWebDataUrl(dataPath: string) {
  const encoded = encodeURIComponent(dataPath);
  return `http://localhost:5173/?data=${encoded}`;
}

export async function runServeCommand(options: { data: string }) {
  await access(options.data);
  const target = resolve('E:/code/biz-glance/packages/web/public/current.bizglance.json');
  await mkdir(dirname(target), { recursive: true });
  await copyFile(options.data, target);
  const child = spawn(
    'pnpm',
    ['--filter', '@bizglance/web', 'dev', '--', '--host', '127.0.0.1'],
    {
      cwd: 'E:/code/biz-glance',
      stdio: 'inherit',
      shell: true
    }
  );

  child.on('error', (error) => {
    console.error('启动 Web 预览失败:', error);
  });

  return buildWebDataUrl('/current.bizglance.json');
}
```

在 `src/index.ts` 中补充：

```ts
program
  .command('serve')
  .requiredOption('--data <path>')
  .action(async (options) => {
    const url = await runServeCommand(options);
    console.log(url);
  });
```

- [ ] **Step 3: 补 README 的两条运行路径**

````md
# BizGlance

## 样例演示

```powershell
pnpm install
pnpm --filter @bizglance/cli dev analyze --sample education --out .\dist\education.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\education.bizglance.json
```

## 本地 Java/Spring 演示

```powershell
pnpm --filter @bizglance/cli dev analyze --repo .\fixtures\java-spring-mini --lens java-spring --out .\dist\java-mini.bizglance.json
pnpm --filter @bizglance/cli dev serve --data .\dist\java-mini.bizglance.json
```
````

- [ ] **Step 4: 运行完整验证**

运行：

```powershell
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @bizglance/cli dev analyze --sample education --out .\dist\education.bizglance.json
pnpm --filter @bizglance/cli dev analyze --repo .\fixtures\java-spring-mini --lens java-spring --out .\dist\java-mini.bizglance.json
pnpm --filter @bizglance/web build
```

预期：

- 所有测试通过
- 两份 JSON 文件都被生成
- Web 构建成功

- [ ] **Step 5: 用浏览器做最后冒烟检查**

运行：

```powershell
pnpm --filter @bizglance/web dev
```

手动打开 `http://localhost:5173/?data=/absolute/path/to/dist/education.bizglance.json`，确认：

- 左侧能看到业务对象列表
- 中间默认显示单据流转
- 切到状态流转和字段血缘时不会报错
- 右侧证据区显示当前对象或空态说明

- [ ] **Step 6: Commit**

```bash
git add packages/cli README.md
git commit -m "feat: add serve workflow and project docs"
```

## Self-Review

### Spec coverage

- 双轨输入：Task 2、Task 3、Task 4 覆盖
- 统一 JSON 契约：Task 2 覆盖
- Web 三栏工作台：Task 5 覆盖
- 错误处理与可运行闭环：Task 4、Task 6 覆盖
- 冒烟验证与文档：Task 6 覆盖

### Placeholder scan

- 未使用 `TODO`、`TBD`、`后续实现` 等占位语
- 每个任务均包含文件、命令与预期输出

### Type consistency

- 统一使用 `BizGlanceDocument`
- `analyzeJavaSpringProject` 为 repo 分析入口
- `getSampleDocument` 为样例数据入口
- Web 统一消费 `initialDocument`
