import type { BizGlanceDocument } from "./schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const flowRelations = new Set(["creates", "updates", "references"]);
const confidenceValues = new Set(["high", "medium", "low"]);
const sourceKinds = new Set(["sample", "explicit", "inferred"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function result(errors: string[], warnings: string[] = []): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function requireArray(target: Record<string, unknown>, key: string, errors: string[]) {
  if (!Array.isArray(target[key])) {
    errors.push(`${key} 必须是数组。`);
    return [];
  }

  return target[key] as unknown[];
}

function validateOptionalConfidence(value: unknown, path: string, errors: string[]) {
  if (value !== undefined && !confidenceValues.has(String(value))) {
    errors.push(`${path} 必须是 high、medium 或 low。`);
  }
}

function validateStringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => !isString(item))) {
    errors.push(`${path} 必须是字符串数组。`);
  }
}

export function validateCodeGraphAssistedAnalysisInput(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return result(["输入必须是 JSON 对象。"]);
  }

  if (!isRecord(input.codegraph)) {
    errors.push("codegraph 必须是对象。");
  }

  if (!isRecord(input.findings)) {
    errors.push("findings 必须是对象。");
    return result(errors);
  }

  const businessObjects = requireArray(input.findings, "businessObjects", errors);
  businessObjects.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`findings.businessObjects[${index}] 必须是对象。`);
      return;
    }

    if (!isString(item.technicalName)) {
      errors.push(`findings.businessObjects[${index}].technicalName 必须是字符串。`);
    }
  });

  if (input.findings.flows !== undefined) {
    if (!Array.isArray(input.findings.flows)) {
      errors.push("findings.flows 必须是数组。");
    } else {
      input.findings.flows.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`findings.flows[${index}] 必须是对象。`);
          return;
        }

        for (const key of ["from", "to", "label"]) {
          if (!isString(item[key])) {
            errors.push(`findings.flows[${index}].${key} 必须是字符串。`);
          }
        }

        if (!flowRelations.has(String(item.relation))) {
          errors.push(`findings.flows[${index}].relation 必须是 creates、updates 或 references。`);
        }

        validateOptionalConfidence(item.confidence, `findings.flows[${index}].confidence`, errors);
      });
    }
  }

  if (input.findings.statusMutations !== undefined) {
    if (!Array.isArray(input.findings.statusMutations)) {
      errors.push("findings.statusMutations 必须是数组。");
    } else {
      input.findings.statusMutations.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`findings.statusMutations[${index}] 必须是对象。`);
          return;
        }

        for (const key of ["object", "field", "trigger"]) {
          if (!isString(item[key])) {
            errors.push(`findings.statusMutations[${index}].${key} 必须是字符串。`);
          }
        }

        validateOptionalConfidence(
          item.confidence,
          `findings.statusMutations[${index}].confidence`,
          errors
        );
      });
    }
  }

  if (input.findings.fieldLineages !== undefined) {
    if (!Array.isArray(input.findings.fieldLineages)) {
      errors.push("findings.fieldLineages 必须是数组。");
    } else {
      input.findings.fieldLineages.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`findings.fieldLineages[${index}] 必须是对象。`);
          return;
        }

        for (const key of ["object", "targetField"]) {
          if (!isString(item[key])) {
            errors.push(`findings.fieldLineages[${index}].${key} 必须是字符串。`);
          }
        }

        if (!Array.isArray(item.sourceFields) || item.sourceFields.some((field) => !isString(field))) {
          errors.push(`findings.fieldLineages[${index}].sourceFields 必须是字符串数组。`);
        }

        validateOptionalConfidence(
          item.confidence,
          `findings.fieldLineages[${index}].confidence`,
          errors
        );
      });
    }
  }

  return result(errors);
}

export function validateBizGlanceDocument(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return result(["输入必须是 JSON 对象。"]);
  }

  if (!isRecord(input.meta)) {
    errors.push("meta 必须是对象。");
  } else {
    if (input.meta.version !== "0.1.0") {
      errors.push("meta.version 必须是 0.1.0。");
    }

    if (!isString(input.meta.generatedAt)) {
      errors.push("meta.generatedAt 必须是字符串。");
    }

    if (!isRecord(input.meta.source)) {
      errors.push("meta.source 必须是对象。");
    } else if (!isString(input.meta.source.name)) {
      errors.push("meta.source.name 必须是字符串。");
    }

    if (!Array.isArray(input.meta.warnings)) {
      errors.push("meta.warnings 必须是数组。");
    }
  }

  const businessObjects = requireArray(input, "businessObjects", errors);
  const flows = requireArray(input, "flows", errors);
  const statusMutations = requireArray(input, "statusMutations", errors);
  const fieldLineages = requireArray(input, "fieldLineages", errors);
  const evidences = requireArray(input, "evidences", errors);

  businessObjects.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`businessObjects[${index}] 必须是对象。`);
      return;
    }

    if (!isString(item.id)) {
      errors.push(`businessObjects[${index}].id 必须是字符串。`);
    }

    if (!isString(item.name)) {
      errors.push(`businessObjects[${index}].name 必须是字符串。`);
    }
  });

  flows.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`flows[${index}] 必须是对象。`);
      return;
    }

    validateStringArray(item.evidenceIds, `flows[${index}].evidenceIds`, errors);

    if (!flowRelations.has(String(item.relation))) {
      errors.push(`flows[${index}].relation 必须是 creates、updates 或 references。`);
    }

    validateOptionalConfidence(item.confidence, `flows[${index}].confidence`, errors);
  });

  statusMutations.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`statusMutations[${index}] 必须是对象。`);
      return;
    }

    validateStringArray(item.evidenceIds, `statusMutations[${index}].evidenceIds`, errors);
    validateOptionalConfidence(item.confidence, `statusMutations[${index}].confidence`, errors);
  });

  fieldLineages.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`fieldLineages[${index}] 必须是对象。`);
      return;
    }

    validateStringArray(item.evidenceIds, `fieldLineages[${index}].evidenceIds`, errors);
    validateStringArray(item.sourceFields, `fieldLineages[${index}].sourceFields`, errors);
    validateOptionalConfidence(item.confidence, `fieldLineages[${index}].confidence`, errors);
  });

  evidences.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`evidences[${index}] 必须是对象。`);
      return;
    }

    if (!isString(item.id)) {
      errors.push(`evidences[${index}].id 必须是字符串。`);
    }
  });

  return result(errors);
}

function collectEvidenceReferenceErrors(document: BizGlanceDocument) {
  const evidenceIds = new Set(document.evidences.map((item) => item.id));
  const errors: string[] = [];

  const check = (
    collectionName: "flows" | "statusMutations" | "fieldLineages",
    items: Array<{ evidenceIds: string[] }>
  ) => {
    items.forEach((item, itemIndex) => {
      if (!Array.isArray(item.evidenceIds)) {
        errors.push(`${collectionName}[${itemIndex}].evidenceIds 必须是字符串数组。`);
        return;
      }

      item.evidenceIds.forEach((evidenceId, evidenceIndex) => {
        if (!evidenceIds.has(evidenceId)) {
          errors.push(
            `${collectionName}[${itemIndex}].evidenceIds[${evidenceIndex}] 引用不存在的 evidence: ${evidenceId}。`
          );
        }
      });
    });
  };

  check("flows", document.flows);
  check("statusMutations", document.statusMutations);
  check("fieldLineages", document.fieldLineages);

  return errors;
}

export function validateBizGlanceEvidenceReferences(input: BizGlanceDocument): ValidationResult {
  return result(collectEvidenceReferenceErrors(input));
}

export function validateCompleteBizGlanceDocument(input: unknown): ValidationResult {
  const documentResult = validateBizGlanceDocument(input);

  if (!documentResult.valid) {
    return documentResult;
  }

  const referenceResult = validateBizGlanceEvidenceReferences(input as BizGlanceDocument);

  return result([...documentResult.errors, ...referenceResult.errors], documentResult.warnings);
}
