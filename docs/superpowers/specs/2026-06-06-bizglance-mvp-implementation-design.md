# BizGlance MVP 实现设计文档

## 1. 目标

本设计文档只覆盖 BizGlance 的第一版可运行闭环，不重复总设计中的长期规划。第一版目标是打通一条真实可用的主链路：

1. 通过 CLI 触发分析
2. 生成统一格式的 `bizglance.json`
3. 通过 Web 读取该 JSON 并展示业务工作台
4. 同时支持稳定演示样例和真实 Java/Spring 项目分析

这一版强调“能跑通、能验证、能继续扩展”，不追求一次性覆盖全部业务识别能力。

## 2. 范围

### 2.1 本次实现范围

- Monorepo 基础骨架
- `packages/core`：统一数据模型、样例数据、Java/Spring 最小分析器、JSON 导出
- `packages/cli`：`analyze` 与 `serve` 命令
- `packages/web`：基于现有 HTML 原型拆出的 React 工作台
- 样例数据源：至少一份内置业务图谱数据
- 真实项目数据源：本地 Java/Spring 项目最小分析能力
- 基础测试：核心模型、CLI、Web 冒烟验证

### 2.2 明确不做

- SQLite 持久化
- MCP 服务
- LLM 语义增强
- 复杂图编辑与拖拽
- 多技术栈 Lens
- 直接分析 GitHub URL 作为产品能力

GitHub 公开仓库可以用于开发阶段参考规则和补充样本，但第一版产品输入只承诺支持本地目录。

## 3. 整体架构

第一版采用三个包构成最小产品主干：

- `packages/core`
  - 定义统一业务图谱模型
  - 提供 `sample` 数据装载
  - 提供 `repo` 分析入口
  - 负责输出标准 `bizglance.json`
- `packages/cli`
  - 暴露 `analyze` 命令，将输入转换为 `bizglance.json`
  - 暴露 `serve` 命令，启动本地 Web 预览
- `packages/web`
  - 读取 JSON 文件
  - 以当前设计稿的三栏工作台方式展示数据

主流程如下：

```text
sample / repo
    -> core normalize
    -> bizglance.json
    -> web load
    -> 业务对象列表 / 三个视图 / 证据面板
```

Web 层不感知数据来源，只消费统一 JSON 契约。

## 4. 目录设计

```text
biz-glance/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── examples/
│   └── education.bizglance.json
├── fixtures/
│   └── java-spring-mini/
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   ├── sample/
│   │   │   ├── analyzers/
│   │   │   ├── export/
│   │   │   └── utils/
│   │   └── tests/
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/
│   │   │   └── utils/
│   │   └── tests/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── styles.css
│       │   ├── components/
│       │   ├── views/
│       │   └── lib/
│       └── tests/
```

## 5. 数据契约

第一版统一输出文件名为 `bizglance.json`。JSON 契约要求“结构稳定、允许部分信息缺失”。

```ts
interface BizGlanceDocument {
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

interface BusinessObject {
  id: string;
  name: string;
  technicalName?: string;
  module?: string;
  description?: string;
  tags?: string[];
}

interface BusinessFlow {
  id: string;
  from: string;
  to: string;
  relation: 'creates' | 'updates' | 'references';
  label: string;
  sourceKind: 'sample' | 'explicit' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  evidenceIds: string[];
}

interface StatusMutation {
  id: string;
  objectId: string;
  field: string;
  trigger: string;
  fromStatus?: string;
  toStatus?: string;
  sourceKind: 'sample' | 'explicit' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  evidenceIds: string[];
}

interface FieldLineage {
  id: string;
  objectId: string;
  targetField: string;
  sourceFields: string[];
  expression?: string;
  sourceKind: 'sample' | 'explicit' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  evidenceIds: string[];
}

interface Evidence {
  id: string;
  title: string;
  filePath?: string;
  symbol?: string;
  route?: string;
  lines?: {
    start: number;
    end: number;
  };
  summary: string;
}
```

前端只强依赖 `businessObjects`、`flows`、`evidences`；其余视图在识别不到数据时显示空态提示。

## 6. 双轨数据源设计

### 6.1 内置样例

样例链路用于保证演示稳定和测试确定性。

- 存放位置：`examples/` 与 `packages/core/src/sample/`
- 第一版至少提供 `education` 样例
- `analyze --sample education` 直接产出标准 JSON
- 样例数据同时作为 Web 视图和 CLI 集成测试夹具

### 6.2 真实项目分析

真实项目第一版只支持本地 Java/Spring 项目路径：

- 输入：`--repo <local-path>`
- Lens：`--lens java-spring`
- 处理方式：
  - 扫描 `.java` 文件
  - 基于规则识别 `Controller`、`Service`、`Mapper`、`Entity/Domain/BO/VO/DTO`
  - 从类名、注解、方法名和字段名抽取业务对象、状态变更和关系

第一版只要求识别最稳定的线索：

- `@RestController`、`@Controller`
- `@RequestMapping`、`@GetMapping`、`@PostMapping`、`@PutMapping`
- `*Service`、`*ServiceImpl`
- `*Mapper`
- `status` / `state`
- `changeStatus`、`updateStatus`、`setStatus`

规则无法得出明确结论时，允许输出部分结果，并通过 `warnings`、`confidence`、`sourceKind` 反映不确定性。

## 7. CLI 设计

第一版命令只保留两条主路径。

### 7.1 analyze

用途：生成 `bizglance.json`

示例：

```bash
pnpm --filter @bizglance/cli dev analyze --sample education --out ./dist/bizglance.json
pnpm --filter @bizglance/cli dev analyze --repo E:\code\java-project --lens java-spring --out ./dist/bizglance.json
```

行为约束：

- `--sample` 与 `--repo` 二选一
- `--out` 必填
- `--lens` 在 `sample` 模式可省略，在 `repo` 模式默认 `java-spring`
- 输出目录不存在时自动创建
- 失败时返回非零退出码

### 7.2 serve

用途：启动本地 Web 页面并读取指定 JSON

示例：

```bash
pnpm --filter @bizglance/cli dev serve --data ./dist/bizglance.json
```

行为约束：

- 启动 `packages/web` 的本地开发服务
- 将指定 JSON 复制或同步到 `packages/web/public/current.bizglance.json`
- 通过查询参数把 `/current.bizglance.json` 传给 Web
- 当数据文件不存在时直接报错，不悄悄回退默认数据

## 8. Web 设计

Web 以 [bizglance-business-workbench.html](E:\code\biz-glance\bizglance-business-workbench.html) 为拆分基准，尽量复用信息架构和视觉风格，不重新发明布局。

### 8.1 页面结构

- 左侧：业务对象列表 + 搜索 + 模块筛选
- 中间：三种视图切换
  - 单据流转
  - 状态流转
  - 字段血缘
- 右侧：业务解释与代码证据

### 8.2 组件拆分

- `App`
- `WorkbenchLayout`
- `ObjectSidebar`
- `ViewTabs`
- `DocumentFlowView`
- `StatusFlowView`
- `FieldLineageView`
- `EvidencePanel`
- `ImportDialog`

### 8.3 第一版交互约束

- 页面启动时如果有数据文件，默认选中第一条业务对象
- 三个视图都从统一状态读取当前选中对象
- `ImportDialog` 第一版保留 UI，但按钮行为仅提示用户先运行 CLI `analyze`
- 页面必须有明确空态与错误态

## 9. 错误处理

第一版错误分三类：

### 9.1 输入错误

- 路径不存在
- 样例名称不存在
- 参数冲突或缺失

处理方式：CLI 直接失败并输出明确提示。

### 9.2 分析能力不足

- 找不到 Controller
- 找不到业务对象
- 无法识别状态变更

处理方式：尽可能输出部分结果，把原因写入 `meta.warnings`。

### 9.3 运行时失败

- 文件读写失败
- JSON 格式不合法
- Web 数据加载失败

处理方式：CLI 或 Web 进入可见错误态，不静默吞掉错误。

## 10. 测试策略

### 10.1 Core

- 数据模型序列化测试
- 内置样例装载测试
- Java/Spring 最小 fixture 分析测试
- 规则识别纯函数测试

### 10.2 CLI

- `analyze --sample` 成功生成 JSON
- `analyze --repo` 成功生成最小结果
- 参数错误能返回失败

### 10.3 Web

- JSON 成功加载并渲染对象列表
- 三个视图可切换
- 缺失状态流转或字段血缘数据时显示空态
- 数据文件缺失时显示错误态

### 10.4 冒烟验证

- 使用样例数据跑通完整展示链路
- 使用本地 Java/Spring fixture 跑通完整展示链路

## 11. 第一版交付标准

满足以下条件即可认定 MVP 可交付：

1. 能通过 CLI 生成一份标准 `bizglance.json`
2. 内置样例数据可稳定展示三栏工作台
3. 本地 Java/Spring fixture 可识别至少一条业务对象关系
4. 页面能展示对象关系、证据摘要和缺失数据空态
5. 基础测试可运行并通过

## 12. 后续扩展点

该设计为后续能力预留了稳定扩展面：

- `source.kind` 与 `lens` 支持更多技术栈
- `warnings`、`confidence`、`sourceKind` 支持逐步增强分析质量
- `bizglance.json` 可作为 SQLite、MCP、LLM 增强的上游输入

因此第一版的重点不是做大，而是把边界、契约和执行路径做清楚。
