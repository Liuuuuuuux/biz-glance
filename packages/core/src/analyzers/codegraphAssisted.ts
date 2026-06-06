import type {
  BizGlanceDocument,
  BusinessFlow,
  BusinessObject,
  Evidence,
  FieldLineage,
  StatusMutation
} from "../schema";

type Confidence = "high" | "medium" | "low";

type CodeGraphNode = {
  kind: string;
  name: string;
  qualifiedName?: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
};

type CodeGraphCodeBlock = {
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
  nodeName?: string;
  nodeKind?: string;
};

type CodeGraphContext = {
  query?: string;
  summary?: string;
  nodes?: CodeGraphNode[];
  edges?: Array<{
    source: string;
    target: string;
    kind: string;
  }>;
  codeBlocks?: CodeGraphCodeBlock[];
  relatedFiles?: string[];
  stats?: {
    nodeCount: number;
    edgeCount: number;
    fileCount: number;
    codeBlockCount: number;
    totalCodeSize: number;
  };
};

type FindingEvidence = {
  nodeName?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  route?: string;
  summary: string;
};

type BusinessObjectFinding = {
  technicalName: string;
  name?: string;
  module?: string;
  description?: string;
  tags?: string[];
  evidence?: FindingEvidence;
};

type FlowFinding = {
  from: string;
  to: string;
  relation: BusinessFlow["relation"];
  label: string;
  confidence?: Confidence;
  evidence?: FindingEvidence;
};

type StatusMutationFinding = {
  object: string;
  field: string;
  trigger: string;
  fromStatus?: string;
  toStatus?: string;
  confidence?: Confidence;
  evidence?: FindingEvidence;
};

type FieldLineageFinding = {
  object: string;
  targetField: string;
  sourceFields: string[];
  expression?: string;
  confidence?: Confidence;
  evidence?: FindingEvidence;
};

export type CodeGraphAssistedAnalysisInput = {
  source: {
    name: string;
    path?: string;
  };
  codegraph: CodeGraphContext;
  findings: {
    businessObjects: BusinessObjectFinding[];
    flows?: FlowFinding[];
    statusMutations?: StatusMutationFinding[];
    fieldLineages?: FieldLineageFinding[];
  };
};

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s.]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function resolveObjectId(value: string, businessObjects: BusinessObject[]) {
  const directId = toKebabCase(value);
  const matched = businessObjects.find(
    (item) =>
      item.id === directId ||
      item.technicalName === value ||
      item.name === value
  );

  return matched?.id ?? directId;
}

function findNode(codegraph: CodeGraphContext, nodeName?: string) {
  if (!nodeName) {
    return undefined;
  }

  return codegraph.nodes?.find(
    (node) =>
      node.name === nodeName ||
      node.qualifiedName === nodeName ||
      node.qualifiedName?.endsWith(`.${nodeName}`) ||
      node.qualifiedName?.endsWith(`::${nodeName}`)
  );
}

function findCodeBlock(codegraph: CodeGraphContext, nodeName?: string) {
  if (!nodeName) {
    return undefined;
  }

  return codegraph.codeBlocks?.find((block) => block.nodeName === nodeName);
}

function createEvidence(
  id: string,
  title: string,
  codegraph: CodeGraphContext,
  evidence: FindingEvidence | undefined
): Evidence {
  const node = findNode(codegraph, evidence?.nodeName);
  const codeBlock = findCodeBlock(codegraph, evidence?.nodeName);
  const filePath = evidence?.filePath ?? codeBlock?.filePath ?? node?.filePath;
  const startLine = evidence?.startLine ?? codeBlock?.startLine ?? node?.startLine;
  const endLine = evidence?.endLine ?? codeBlock?.endLine ?? node?.endLine;

  return {
    id,
    title,
    filePath,
    symbol: evidence?.nodeName ?? node?.name,
    route: evidence?.route,
    lines:
      startLine && endLine
        ? {
            start: startLine,
            end: endLine
          }
        : undefined,
    summary: evidence?.summary ?? codegraph.summary ?? "CodeGraph 上下文证据"
  };
}

function pushEvidence(evidences: Evidence[], evidence: Evidence) {
  if (evidences.some((item) => item.id === evidence.id)) {
    return;
  }

  evidences.push(evidence);
}

export function analyzeCodeGraphContext(
  input: CodeGraphAssistedAnalysisInput
): BizGlanceDocument {
  const evidences: Evidence[] = [];
  const businessObjects: BusinessObject[] = input.findings.businessObjects.map((finding) => {
    const id = toKebabCase(finding.technicalName);

    if (finding.evidence) {
      pushEvidence(
        evidences,
        createEvidence(
          `codegraph-object-${id}`,
          `${finding.name ?? finding.technicalName} 业务对象`,
          input.codegraph,
          finding.evidence
        )
      );
    }

    return {
      id,
      name: finding.name ?? finding.technicalName,
      technicalName: finding.technicalName,
      module: finding.module,
      description: finding.description,
      tags: finding.tags
    };
  });

  const flows: BusinessFlow[] = (input.findings.flows ?? []).map((finding, index) => {
    const from = resolveObjectId(finding.from, businessObjects);
    const to = resolveObjectId(finding.to, businessObjects);
    const evidenceId = `codegraph-flow-${index + 1}`;

    pushEvidence(
      evidences,
      createEvidence(evidenceId, finding.label, input.codegraph, finding.evidence)
    );

    return {
      id: evidenceId,
      from,
      to,
      relation: finding.relation,
      label: finding.label,
      sourceKind: "inferred",
      confidence: finding.confidence ?? "medium",
      evidenceIds: [evidenceId]
    };
  });

  const statusMutations: StatusMutation[] = (input.findings.statusMutations ?? []).map(
    (finding, index) => {
      const objectId = resolveObjectId(finding.object, businessObjects);
      const evidenceId = `codegraph-status-${index + 1}`;

      pushEvidence(
        evidences,
        createEvidence(
          evidenceId,
          `${finding.object}.${finding.field} 状态变更`,
          input.codegraph,
          finding.evidence
        )
      );

      return {
        id: evidenceId,
        objectId,
        field: finding.field,
        trigger: finding.trigger,
        fromStatus: finding.fromStatus,
        toStatus: finding.toStatus,
        sourceKind: "inferred",
        confidence: finding.confidence ?? "medium",
        evidenceIds: [evidenceId]
      };
    }
  );

  const fieldLineages: FieldLineage[] = (input.findings.fieldLineages ?? []).map(
    (finding, index) => {
      const objectId = resolveObjectId(finding.object, businessObjects);
      const evidenceId = `codegraph-lineage-${index + 1}`;

      pushEvidence(
        evidences,
        createEvidence(
          evidenceId,
          `${finding.object}.${finding.targetField} 字段血缘`,
          input.codegraph,
          finding.evidence
        )
      );

      return {
        id: evidenceId,
        objectId,
        targetField: finding.targetField,
        sourceFields: finding.sourceFields.map((field) => {
          const [objectName, fieldName] = field.split(".");
          return fieldName
            ? `${resolveObjectId(objectName, businessObjects)}.${fieldName}`
            : field;
        }),
        expression: finding.expression,
        sourceKind: "inferred",
        confidence: finding.confidence ?? "medium",
        evidenceIds: [evidenceId]
      };
    }
  );

  return {
    meta: {
      version: "0.1.0",
      generatedAt: new Date().toISOString(),
      source: {
        kind: "repo",
        name: input.source.name,
        lens: "codegraph-assisted",
        path: input.source.path
      },
      warnings: [
        businessObjects.length === 0 ? "CodeGraph/LLM 上下文未识别到业务对象" : "",
        input.codegraph.stats
          ? `CodeGraph 节点 ${input.codegraph.stats.nodeCount} 个，边 ${input.codegraph.stats.edgeCount} 条，代码块 ${input.codegraph.stats.codeBlockCount} 个`
          : ""
      ].filter(Boolean)
    },
    businessObjects,
    flows,
    statusMutations,
    fieldLineages,
    evidences
  };
}
