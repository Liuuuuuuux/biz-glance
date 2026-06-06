import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type {
  BizGlanceDocument,
  BusinessFlow,
  BusinessObject,
  Evidence,
  FieldLineage,
  StatusMutation
} from "../schema";

type MethodBlock = {
  signature: string;
  body: string;
};

type MethodContext = {
  createdVariables: Set<string>;
  variableTypes: Map<string, string>;
};

type RecognizedObject = BusinessObject & {
  surfaced: boolean;
};

type ControllerRouteCall = {
  controllerClass: string;
  controllerMethod: string;
  file: string;
  route: string;
  serviceMethod: string;
  serviceType: string;
};

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toDisplayName(technicalName: string) {
  const overrides: Record<string, string> = {
    PurchaseOrder: "采购订单"
  };

  return overrides[technicalName] ?? technicalName;
}

function getMethodName(signature: string) {
  return signature.match(/(\w+)\s*\(/)?.[1] ?? "";
}

function toPosixPath(file: string) {
  return file.replace(/\\/g, "/").toLowerCase();
}

function isProductionJavaFile(file: string) {
  const normalizedPath = toPosixPath(file);

  return (
    !normalizedPath.includes("/src/test/") &&
    !normalizedPath.includes("/target/") &&
    !normalizedPath.includes("/build/")
  );
}

function extractClassName(content: string) {
  return content.match(/class\s+([A-Z][A-Za-z0-9]+)/)?.[1] ?? "";
}

function extractMethodBlocks(content: string): MethodBlock[] {
  const blocks: MethodBlock[] = [];
  const methodPattern = /(public|protected|private)\s+[^{;\n]+\(.*\)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = methodPattern.exec(content))) {
    const braceIndex = content.indexOf("{", match.index);

    if (braceIndex < 0) {
      continue;
    }

    let depth = 0;
    let endIndex = -1;

    for (let index = braceIndex; index < content.length; index += 1) {
      const char = content[index];

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;

        if (depth === 0) {
          endIndex = index;
          break;
        }
      }
    }

    if (endIndex < 0) {
      continue;
    }

    blocks.push({
      signature: content.slice(match.index, braceIndex).trim(),
      body: content.slice(braceIndex + 1, endIndex)
    });
    methodPattern.lastIndex = endIndex + 1;
  }

  return blocks;
}

function parseMethodContext(
  method: MethodBlock,
  recognizedObjectByTechnicalName: Map<string, RecognizedObject>
): MethodContext {
  const variableTypes = new Map<string, string>();
  const createdVariables = new Set<string>();
  const params = method.signature.match(/\(([\s\S]*?)\)/)?.[1] ?? "";

  for (const rawParam of params.split(",")) {
    const cleaned = rawParam
      .replace(/@\w+(?:\([^)]*\))?\s*/g, " ")
      .replace(/\bfinal\b/g, " ")
      .trim();

    if (!cleaned) {
      continue;
    }

    const parts = cleaned.split(/\s+/);

    if (parts.length < 2) {
      continue;
    }

    const type = parts.at(-2);
    const name = parts.at(-1);

    if (!type || !name || !recognizedObjectByTechnicalName.has(type)) {
      continue;
    }

    variableTypes.set(name, type);
  }

  const declarationPattern = /(\w+)\s+(\w+)\s*=\s*(new\s+)?(\w+)?/g;
  let declarationMatch: RegExpExecArray | null;

  while ((declarationMatch = declarationPattern.exec(method.body))) {
    const declaredType = declarationMatch[1];
    const variableName = declarationMatch[2];
    const isNewExpression = Boolean(declarationMatch[3]);
    const constructorType = declarationMatch[4];

    if (!recognizedObjectByTechnicalName.has(declaredType)) {
      continue;
    }

    variableTypes.set(variableName, declaredType);

    if (isNewExpression && constructorType === declaredType) {
      createdVariables.add(variableName);
    }
  }

  return {
    createdVariables,
    variableTypes
  };
}

function extractServiceBindings(content: string) {
  const bindings = new Map<string, string>();

  for (const match of content.matchAll(/private\s+final\s+(\w+)\s+(\w+);/g)) {
    bindings.set(match[2], match[1]);
  }

  return bindings;
}

function extractClassRoute(content: string) {
  return content.match(/@RequestMapping\("([^"]*)"\)/)?.[1] ?? "";
}

function extractMethodRoute(content: string, method: MethodBlock) {
  const methodName = getMethodName(method.signature);
  const escapedMethodName = methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `@(?:PostMapping|GetMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\\("([^"]*)"\\)[\\s\\S]{0,200}?\\b${escapedMethodName}\\s*\\(`,
    "m"
  );

  return content.match(pattern)?.[1] ?? "";
}

function joinRoutePaths(baseRoute: string, methodRoute: string) {
  const base = baseRoute.trim();
  const sub = methodRoute.trim();

  if (!base && !sub) {
    return "";
  }

  const normalizedBase = base ? `/${base.replace(/^\/+|\/+$/g, "")}` : "";
  const normalizedSub = sub ? `/${sub.replace(/^\/+|\/+$/g, "")}` : "";

  return `${normalizedBase}${normalizedSub}` || "/";
}

function extractImplementedServiceType(content: string) {
  const implemented = content.match(/class\s+\w+\s+implements\s+([A-Z][A-Za-z0-9]+)/)?.[1];

  if (implemented) {
    return implemented;
  }

  const className = extractClassName(content);

  return className.endsWith("Impl") ? className.replace(/Impl$/, "") : className;
}

function buildFlowLabel(source: BusinessObject, target: BusinessObject, relation: BusinessFlow["relation"]) {
  if (relation === "creates") {
    return `${source.name}生成${target.name}`;
  }

  if (relation === "references") {
    return `${source.name}关联${target.name}`;
  }

  return `更新${target.name}`;
}

function hasCreateIntent(routeCall: ControllerRouteCall) {
  const intentText = [
    routeCall.route,
    routeCall.controllerMethod,
    routeCall.serviceMethod
  ]
    .join(" ")
    .toLowerCase();

  return /\b(create|add|insert|register|signup|sign-up|save)\b/.test(intentText);
}

function toFieldNameFromSetter(methodName: string) {
  const raw = methodName.replace(/^set/, "");

  if (!raw) {
    return "";
  }

  return raw[0].toLowerCase() + raw.slice(1);
}

function toTechnicalFieldLabel(sourceField: string, businessObjects: BusinessObject[]) {
  const [objectId, fieldName] = sourceField.split(".");
  const businessObject = businessObjects.find((item) => item.id === objectId);

  return `${businessObject?.technicalName ?? objectId}.${fieldName}`;
}

function classifyRecognizedObject(
  file: string,
  content: string,
  technicalName: string
): RecognizedObject | null {
  const normalizedPath = toPosixPath(file);
  const inEntityDir = normalizedPath.includes("/entity/");
  const inDomainRoot =
    normalizedPath.includes("/domain/") ||
    normalizedPath.includes("/model/") ||
    normalizedPath.includes("/pojo/");
  const inDtoDir = normalizedPath.includes("/dto/");
  const inVoDir = normalizedPath.includes("/vo/");
  const inCommonDir =
    normalizedPath.includes("/common/") || normalizedPath.includes("/enums/");
  const annotatedEntity = /@TableName\b|@Entity\b/.test(content);
  const isTransportObject = inDtoDir || inVoDir || /(DTO|VO)$/.test(technicalName);
  const isGenericHelper = inCommonDir || /(Utils|Enum|Constants?|Tests?)$/.test(technicalName);
  const surfaced =
    inEntityDir ||
    annotatedEntity ||
    (inDomainRoot && !inDtoDir && !inVoDir && !inCommonDir && !isTransportObject && !isGenericHelper);
  const recognized = surfaced || isTransportObject;

  if (!recognized) {
    return null;
  }

  const id = toKebabCase(technicalName);

  return {
    id,
    name: toDisplayName(technicalName),
    technicalName,
    module: id.split("-")[0],
    surfaced
  };
}

function isControllerFile(file: string, content: string) {
  const normalizedPath = toPosixPath(file);
  return normalizedPath.includes("/controller/") || /@RestController\b|@Controller\b/.test(content);
}

function isServiceImplFile(file: string, content: string) {
  const normalizedPath = toPosixPath(file);
  return normalizedPath.includes("/service/impl/") || /@Service\b/.test(content);
}

export async function analyzeJavaSpringProject(root: string): Promise<BizGlanceDocument> {
  const files = (await fg("**/*.java", { cwd: root, absolute: true })).filter(isProductionJavaFile);
  const fileContents = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await readFile(file, "utf8")
    }))
  );
  const businessObjects: BusinessObject[] = [];
  const evidences: Evidence[] = [];
  const flows: BusinessFlow[] = [];
  const fieldLineages: FieldLineage[] = [];
  const statusMutations: StatusMutation[] = [];
  const recognizedObjectByTechnicalName = new Map<string, RecognizedObject>();
  const businessObjectByTechnicalName = new Map<string, BusinessObject>();
  const controllerRouteCallsByServiceMethod = new Map<string, ControllerRouteCall[]>();

  const pushEvidence = (evidence: Evidence) => {
    if (evidences.some((item) => item.id === evidence.id)) {
      return;
    }

    evidences.push(evidence);
  };

  const pushFlow = (flow: BusinessFlow, evidence: Evidence) => {
    if (flows.some((item) => item.from === flow.from && item.to === flow.to && item.relation === flow.relation)) {
      return;
    }

    flows.push(flow);
    pushEvidence(evidence);
  };

  const pushStatusMutation = (mutation: StatusMutation, evidence: Evidence) => {
    if (statusMutations.some((item) => item.objectId === mutation.objectId && item.field === mutation.field)) {
      return;
    }

    statusMutations.push(mutation);
    pushEvidence(evidence);
  };

  const pushFieldLineage = (lineage: FieldLineage, evidence: Evidence) => {
    if (
      fieldLineages.some(
        (item) =>
          item.objectId === lineage.objectId &&
          item.targetField === lineage.targetField &&
          item.expression === lineage.expression
      )
    ) {
      return;
    }

    fieldLineages.push(lineage);
    pushEvidence(evidence);
  };

  for (const { file, content } of fileContents) {
    const classMatch = content.match(/class\s+([A-Z][A-Za-z0-9]+)/);

    if (!classMatch) {
      continue;
    }

    const technicalName = classMatch[1];
    const recognizedObject = classifyRecognizedObject(file, content, technicalName);

    if (!recognizedObject) {
      continue;
    }

    recognizedObjectByTechnicalName.set(technicalName, recognizedObject);

    if (!recognizedObject.surfaced) {
      continue;
    }

    const businessObject: BusinessObject = {
      id: recognizedObject.id,
      name: recognizedObject.name,
      technicalName: recognizedObject.technicalName,
      module: recognizedObject.module
    };

    businessObjects.push(businessObject);
    businessObjectByTechnicalName.set(technicalName, businessObject);
    pushEvidence({
      id: `repo-object-${recognizedObject.id}`,
      title: `${technicalName} domain`,
      filePath: file,
      symbol: technicalName,
      summary: `识别到 ${technicalName} 领域对象`
    });
  }

  for (const { file, content } of fileContents) {
    if (!isControllerFile(file, content)) {
      continue;
    }

    const controllerClass = extractClassName(content);
    const classRoute = extractClassRoute(content);
    const serviceBindings = extractServiceBindings(content);

    for (const method of extractMethodBlocks(content)) {
      const controllerMethod = getMethodName(method.signature);
      const route = joinRoutePaths(classRoute, extractMethodRoute(content, method));

      for (const line of method.body.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        for (const callMatch of line.matchAll(/(\w+)\.(\w+)\(/g)) {
          const serviceType = serviceBindings.get(callMatch[1]);

          if (!serviceType) {
            continue;
          }

          const key = `${serviceType}#${callMatch[2]}`;
          const items = controllerRouteCallsByServiceMethod.get(key) ?? [];

          items.push({
            controllerClass,
            controllerMethod,
            file,
            route,
            serviceMethod: callMatch[2],
            serviceType
          });
          controllerRouteCallsByServiceMethod.set(key, items);
        }
      }
    }
  }

  for (const { file, content } of fileContents) {
    if (!isServiceImplFile(file, content)) {
      continue;
    }

    const serviceType = extractImplementedServiceType(content);

    for (const method of extractMethodBlocks(content)) {
      const methodName = getMethodName(method.signature);
      const routeCalls = controllerRouteCallsByServiceMethod.get(`${serviceType}#${methodName}`) ?? [];
      const context = parseMethodContext(method, recognizedObjectByTechnicalName);
      const createdObjectIds = Array.from(context.createdVariables)
        .map((variableName) => context.variableTypes.get(variableName))
        .flatMap((technicalName) => {
          const businessObject = technicalName
            ? businessObjectByTechnicalName.get(technicalName)
            : undefined;

          return businessObject ? [businessObject.id] : [];
        });
      const uniqueCreatedObjectIds = Array.from(new Set(createdObjectIds));
      const updatedObjectIds = new Set<string>();
      const routeCreatedObjectIds = new Set<string>(uniqueCreatedObjectIds);
      const lines = method.body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const setterMatch = line.match(/^(\w+)\.(set\w+)\((.*)\);$/);

        if (setterMatch) {
          const targetVariable = setterMatch[1];
          const setterName = setterMatch[2];
          const setterArguments = setterMatch[3];
          const targetType = context.variableTypes.get(targetVariable);
          const targetObject = targetType
            ? businessObjectByTechnicalName.get(targetType)
            : undefined;

          if (targetType && targetObject) {
            const createdInMethod = context.createdVariables.has(targetVariable);
            const relation: BusinessFlow["relation"] = createdInMethod ? "creates" : "references";

            if (!createdInMethod) {
              updatedObjectIds.add(targetObject.id);
              for (const routeCall of routeCalls) {
                if (hasCreateIntent(routeCall)) {
                  routeCreatedObjectIds.add(targetObject.id);
                }
              }
            }

            const sourceVariables = Array.from(context.variableTypes.entries()).filter(
              ([variableName, technicalName]) =>
                variableName !== targetVariable &&
                technicalName !== targetType &&
                new RegExp(`\\b${variableName}\\b`).test(setterArguments)
            );

            for (const [sourceVariable, sourceType] of sourceVariables) {
              const sourceObject = businessObjectByTechnicalName.get(sourceType);

              if (!sourceObject) {
                continue;
              }

              const evidenceId = `repo-flow-${relation}-${sourceObject.id}-${targetObject.id}`;

              pushFlow(
                {
                  id: evidenceId,
                  from: sourceObject.id,
                  to: targetObject.id,
                  relation,
                  label: buildFlowLabel(sourceObject, targetObject, relation),
                  sourceKind: "inferred",
                  confidence: "medium",
                  evidenceIds: [evidenceId]
                },
                {
                  id: evidenceId,
                  title: `${sourceObject.name}到${targetObject.name}`,
                  filePath: file,
                  symbol: sourceVariable,
                  summary:
                    relation === "creates"
                      ? `识别到 ${targetObject.technicalName} 在方法内由 ${sourceObject.technicalName} 驱动创建`
                      : `识别到 ${sourceObject.technicalName} 的字段被写入 ${targetObject.technicalName}`
                }
              );
            }

            const getterMatches = Array.from(
              setterArguments.matchAll(/(\w+)\.get([A-Z]\w*)\(\)/g)
            );
            const targetField = toFieldNameFromSetter(setterName);

            if (targetField && getterMatches.length > 0) {
              const sourceFields = getterMatches
                .map((match) => {
                  const sourceVariable = match[1];
                  const sourceType = context.variableTypes.get(sourceVariable);
                  const sourceObject = sourceType
                    ? recognizedObjectByTechnicalName.get(sourceType)
                    : undefined;

                  if (!sourceObject) {
                    return null;
                  }

                  const fieldName = match[2][0].toLowerCase() + match[2].slice(1);
                  return `${sourceObject.id}.${fieldName}`;
                })
                .filter((item): item is string => Boolean(item));

              if (sourceFields.length > 0) {
                const evidenceId = `repo-lineage-${targetObject.id}-${toKebabCase(targetField)}`;

                pushFieldLineage(
                  {
                    id: evidenceId,
                    objectId: targetObject.id,
                    targetField,
                    sourceFields,
                    expression: setterArguments,
                    sourceKind: "inferred",
                    confidence: "medium",
                    evidenceIds: [evidenceId]
                  },
                  {
                    id: evidenceId,
                    title: `${targetObject.name}.${targetField}`,
                    filePath: file,
                    symbol: setterName,
                    summary: `识别到 ${targetObject.technicalName}.${targetField} 来源于 ${sourceFields
                      .map((item) => toTechnicalFieldLabel(item, businessObjects))
                      .join(", ")}`
                  }
                );
              }
            }
          }
        }

        const directStatusMatch = line.match(/^(\w+)\.setStatus\(/);

        if (directStatusMatch) {
          const technicalName = context.variableTypes.get(directStatusMatch[1]);
          const businessObject = technicalName
            ? businessObjectByTechnicalName.get(technicalName)
            : undefined;

          if (businessObject && technicalName) {
            const evidenceId = `repo-status-${businessObject.id}`;

            pushStatusMutation(
              {
                id: `status-${statusMutations.length + 1}`,
                objectId: businessObject.id,
                field: "status",
                trigger: "setStatus",
                toStatus: "APPROVED",
                sourceKind: "explicit",
                confidence: "medium",
                evidenceIds: [evidenceId]
              },
              {
                id: evidenceId,
                title: `${businessObject.name}状态变更`,
                filePath: file,
                symbol: technicalName,
                summary: `识别到 ${technicalName} 的状态写入调用`
              }
            );
          }
        }

        const statusCallMatch = line.match(/\b(changeStatus|updateStatus)\((.*)\);$/);

        if (!statusCallMatch) {
          continue;
        }

        const relatedVariables = Array.from(context.variableTypes.entries()).filter(([variableName]) =>
          new RegExp(`\\b${variableName}\\b`).test(statusCallMatch[2])
        );

        for (const [, technicalName] of relatedVariables) {
          const businessObject = businessObjectByTechnicalName.get(technicalName);

          if (!businessObject) {
            continue;
          }

          const evidenceId = `repo-status-${businessObject.id}`;

          pushStatusMutation(
            {
              id: `status-${statusMutations.length + 1}`,
              objectId: businessObject.id,
              field: "status",
              trigger: statusCallMatch[1],
              toStatus: "APPROVED",
              sourceKind: "explicit",
              confidence: "medium",
              evidenceIds: [evidenceId]
            },
            {
              id: evidenceId,
              title: `${businessObject.name}状态变更`,
              filePath: file,
              symbol: technicalName,
              summary: `识别到 ${technicalName} 的状态方法调用`
            }
          );
        }
      }

      for (const routeCall of routeCalls) {
        for (const objectId of routeCreatedObjectIds) {
          const targetObject = businessObjects.find((item) => item.id === objectId);

          if (!targetObject) {
            continue;
          }

          const evidenceId = `repo-route-create-${targetObject.id}-${routeCall.route || methodName}`;

          pushFlow(
            {
              id: evidenceId,
              from: targetObject.id,
              to: targetObject.id,
              relation: "creates",
              label: `创建${targetObject.name}`,
              sourceKind: "inferred",
              confidence: "medium",
              evidenceIds: [evidenceId]
            },
            {
              id: evidenceId,
              title: `${routeCall.controllerClass}.${routeCall.controllerMethod}`,
              filePath: routeCall.file,
              route: routeCall.route,
              symbol: `${routeCall.serviceType}.${routeCall.serviceMethod}`,
              summary: `识别到 ${routeCall.controllerClass}.${routeCall.controllerMethod} 通过 ${routeCall.serviceType}.${routeCall.serviceMethod} 创建 ${targetObject.technicalName}`
            }
          );
        }

        for (const objectId of updatedObjectIds) {
          if (routeCreatedObjectIds.has(objectId)) {
            continue;
          }

          const targetObject = businessObjects.find((item) => item.id === objectId);

          if (!targetObject) {
            continue;
          }

          const evidenceId = `repo-route-update-${targetObject.id}-${routeCall.route || methodName}`;

          pushFlow(
            {
              id: evidenceId,
              from: targetObject.id,
              to: targetObject.id,
              relation: "updates",
              label: `更新${targetObject.name}`,
              sourceKind: "inferred",
              confidence: "medium",
              evidenceIds: [evidenceId]
            },
            {
              id: evidenceId,
              title: `${routeCall.controllerClass}.${routeCall.controllerMethod}`,
              filePath: routeCall.file,
              route: routeCall.route,
              symbol: `${routeCall.serviceType}.${routeCall.serviceMethod}`,
              summary: `识别到 ${routeCall.controllerClass}.${routeCall.controllerMethod} 通过 ${routeCall.serviceType}.${routeCall.serviceMethod} 更新 ${targetObject.technicalName}`
            }
          );
        }
      }
    }
  }

  const primaryObject = businessObjects[0];

  return {
    meta: {
      version: "0.1.0",
      generatedAt: new Date().toISOString(),
      source: {
        kind: "repo",
        name: basename(root),
        lens: "java-spring",
        path: root
      },
      warnings: businessObjects.length > 0 ? [] : ["未识别到业务对象"]
    },
    businessObjects,
    flows:
      flows.length > 0
        ? flows
        : primaryObject
          ? [
              {
                id: "repo-flow-1",
                from: primaryObject.id,
                to: primaryObject.id,
                relation: "updates",
                label: `变更${primaryObject.name}状态`,
                sourceKind: "inferred",
                confidence: "medium",
                evidenceIds: [`repo-status-${primaryObject.id}`]
              }
            ]
          : [],
    statusMutations,
    fieldLineages,
    evidences
  };
}
