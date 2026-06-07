export interface BizGlanceDocument {
  meta: {
    version: "0.1.0";
    generatedAt: string;
    source: {
      kind: "sample" | "repo";
      name: string;
      lens: "generic-sample" | "codegraph-assisted";
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

export interface BusinessObject {
  id: string;
  name: string;
  technicalName?: string;
  module?: string;
  description?: string;
  tags?: string[];
}

export interface BusinessFlow {
  id: string;
  from: string;
  to: string;
  relation: "creates" | "updates" | "references";
  label: string;
  sourceKind: "sample" | "explicit" | "inferred";
  confidence: "high" | "medium" | "low";
  evidenceIds: string[];
}

export interface StatusMutation {
  id: string;
  objectId: string;
  field: string;
  trigger: string;
  fromStatus?: string;
  toStatus?: string;
  sourceKind: "sample" | "explicit" | "inferred";
  confidence: "high" | "medium" | "low";
  evidenceIds: string[];
}

export interface FieldLineage {
  id: string;
  objectId: string;
  targetField: string;
  sourceFields: string[];
  expression?: string;
  sourceKind: "sample" | "explicit" | "inferred";
  confidence: "high" | "medium" | "low";
  evidenceIds: string[];
}

export interface Evidence {
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
