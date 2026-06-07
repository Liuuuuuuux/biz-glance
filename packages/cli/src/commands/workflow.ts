import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAnalyzeCommand } from "./analyze";
import { runInitCommand, type InitResult } from "./init";
import { runServeCommand } from "./serve";
import { runValidateCommand, type ValidateCommandResult } from "./validate";

const DEFAULT_WORKSPACE_DIR = ".bizglance";
const DEFAULT_OUTPUT_FILE = "bizglance.json";
const DEFAULT_INTERMEDIATE_INPUT_FILE = "codegraph-assisted-input.json";
const DEFAULT_REPO_CONTEXT_FILE = "repo-context.json";
const DEFAULT_CODEGRAPH_CONTEXT_FILE = "codegraph-context.json";
const DEFAULT_BUSINESS_OBJECT_FINDINGS_FILE = "business-object-findings.json";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

async function defaultFileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveWorkspacePaths(repo: string, workspaceDir: string) {
  return {
    workspaceDir,
    configPath: resolve(workspaceDir, "config.json"),
    outputPath: resolve(workspaceDir, DEFAULT_OUTPUT_FILE),
    intermediateDir: resolve(workspaceDir, "intermediate"),
    cachedInputPath: resolve(workspaceDir, "intermediate", DEFAULT_INTERMEDIATE_INPUT_FILE),
    repoRoot: repo
  };
}

export interface WorkflowCommandResult {
  workspaceDir: string;
  outputPath: string;
  previewUrl?: string;
}

type RepoContext = {
  repo?: {
    name?: string;
    root?: string;
  };
  readme?: {
    summary?: string;
  };
  stats?: {
    fileCount?: number;
    sourceFileCount?: number;
  };
  entrypoints?: Array<{
    filePath: string;
    kind: string;
    symbol?: string;
    route?: string;
    line?: number;
  }>;
  entityCandidates?: Array<{
    filePath: string;
    technicalName: string;
    line?: number;
  }>;
};

function normalizePathForJson(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildCodeGraphContextFromRepoContext(repoContext: RepoContext) {
  const entityNodes = (repoContext.entityCandidates ?? []).map((item) => ({
    kind: "entity-candidate",
    name: item.technicalName,
    filePath: item.filePath,
    startLine: item.line,
    endLine: item.line
  }));
  const entrypointNodes = (repoContext.entrypoints ?? []).map((item) => ({
    kind: item.kind,
    name: item.symbol ?? item.route ?? item.filePath,
    filePath: item.filePath,
    startLine: item.line,
    endLine: item.line
  }));
  const nodes = [...entityNodes, ...entrypointNodes];

  return {
    query: "BizGlance deterministic repository preprocessor",
    summary:
      repoContext.readme?.summary ??
      "BizGlance 根据仓库文件、入口点和实体候选生成的确定性代码事实。",
    nodes,
    edges: [],
    codeBlocks: [],
    relatedFiles: Array.from(new Set(nodes.map((item) => item.filePath).filter(Boolean))),
    stats: {
      nodeCount: nodes.length,
      edgeCount: 0,
      fileCount: repoContext.stats?.fileCount ?? 0,
      codeBlockCount: 0,
      totalCodeSize: 0
    }
  };
}

function buildBusinessObjectFindingsFromRepoContext(repoContext: RepoContext, language?: string) {
  return (repoContext.entityCandidates ?? []).map((item) => ({
    technicalName: item.technicalName,
    name: item.technicalName,
    description:
      language === "en"
        ? "Deterministic entity candidate. Run the LLM business agents for a business name and richer description."
        : "确定性实体候选。运行 LLM 业务 agent 后可补充业务名和更完整说明。",
    tags: ["entity-candidate"],
    evidence: {
      nodeName: item.technicalName,
      filePath: item.filePath,
      startLine: item.line,
      endLine: item.line,
      summary:
        language === "en"
          ? "Detected by collect-repo-context.mjs from repository structure."
          : "由 collect-repo-context.mjs 根据仓库结构识别。"
    }
  }));
}

async function defaultGenerateContext(options: {
  repo: string;
  intermediateDir: string;
  language?: string;
}): Promise<string> {
  const repoContextPath = resolve(options.intermediateDir, DEFAULT_REPO_CONTEXT_FILE);
  const codegraphContextPath = resolve(options.intermediateDir, DEFAULT_CODEGRAPH_CONTEXT_FILE);
  const businessObjectFindingsPath = resolve(options.intermediateDir, DEFAULT_BUSINESS_OBJECT_FINDINGS_FILE);
  const outputPath = resolve(options.intermediateDir, DEFAULT_INTERMEDIATE_INPUT_FILE);
  const collectScriptPath = resolve(REPO_ROOT, "skills/bizglance/scripts/collect-repo-context.mjs");
  const mergeScriptPath = resolve(REPO_ROOT, "skills/bizglance/scripts/merge-business-findings.mjs");
  const { collectRepoContext } = await import(pathToFileURL(collectScriptPath).href);
  const { mergeBusinessFindings } = await import(pathToFileURL(mergeScriptPath).href);

  await collectRepoContext({
    repo: options.repo,
    output: repoContextPath
  });

  const repoContext = await readJsonFile<RepoContext>(repoContextPath);

  try {
    await access(codegraphContextPath);
  } catch {
    await writeJsonFile(codegraphContextPath, buildCodeGraphContextFromRepoContext(repoContext));
  }

  try {
    await access(businessObjectFindingsPath);
  } catch {
    await writeJsonFile(
      businessObjectFindingsPath,
      buildBusinessObjectFindingsFromRepoContext(repoContext, options.language)
    );
  }

  await mergeBusinessFindings({
    intermediateDir: options.intermediateDir,
    output: outputPath
  });

  return normalizePathForJson(outputPath);
}

export async function runWorkflowCommand(options: {
  repo?: string;
  codegraphContext?: string;
  noServe?: boolean;
  full?: boolean;
  review?: boolean;
  language?: string;
  initCommand?: (options: { repo?: string }) => Promise<InitResult>;
  analyzeCommand?: (options: {
    repo?: string;
    codegraphContext?: string;
    out?: string;
    lens?: string;
    full?: boolean;
    review?: boolean;
    language?: string;
  }) => Promise<void>;
  validateCommand?: (options: {
    input: string;
    kind?: "auto" | "document" | "context";
  }) => Promise<ValidateCommandResult>;
  serveCommand?: (options: { data?: string }) => Promise<string>;
  generateContext?: (options: {
    repo: string;
    intermediateDir: string;
    language?: string;
  }) => Promise<string>;
  fileExists?: (filePath: string) => Promise<boolean>;
  readTextFile?: (filePath: string) => Promise<string>;
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
}): Promise<WorkflowCommandResult> {
  if (options.full && options.review) {
    throw new Error("不能同时使用 --full 和 --review。");
  }

  const repo = resolveFromInitCwd(options.repo ?? ".");
  const initCommand = options.initCommand ?? runInitCommand;
  const analyzeCommand = options.analyzeCommand ?? runAnalyzeCommand;
  const validateCommand = options.validateCommand ?? runValidateCommand;
  const serveCommand = options.serveCommand ?? runServeCommand;
  const generateContext = options.generateContext ?? defaultGenerateContext;
  const fileExists = options.fileExists ?? defaultFileExists;
  const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));
  const writeTextFile = options.writeTextFile ?? ((filePath: string, content: string) => writeFile(filePath, content, "utf8"));

  const initResult = await initCommand({ repo });
  const workspaceDir = resolve(initResult.workspaceDir ?? resolve(repo, DEFAULT_WORKSPACE_DIR));
  const paths = resolveWorkspacePaths(repo, workspaceDir);

  if (options.language) {
    const currentConfig = JSON.parse(await readTextFile(paths.configPath)) as Record<string, unknown>;

    if (currentConfig.language !== options.language) {
      await writeTextFile(
        paths.configPath,
        `${JSON.stringify(
          {
            ...currentConfig,
            language: options.language
          },
          null,
          2
        )}\n`
      );
    }
  }

  if (options.review) {
    if (!(await fileExists(paths.outputPath))) {
      throw new Error("review 模式要求已存在 .bizglance/bizglance.json。");
    }

    await validateCommand({
      input: paths.outputPath,
      kind: "document"
    });

    if (options.noServe) {
      return {
        workspaceDir: paths.workspaceDir,
        outputPath: paths.outputPath
      };
    }

    const previewUrl = await serveCommand({
      data: paths.outputPath
    });

    return {
      workspaceDir: paths.workspaceDir,
      outputPath: paths.outputPath,
      previewUrl
    };
  }

  let resolvedContextPath =
    options.codegraphContext ??
    (!(options.full) && (await fileExists(paths.cachedInputPath)) ? paths.cachedInputPath : undefined);

  if (!resolvedContextPath) {
    resolvedContextPath = await generateContext({
      repo,
      intermediateDir: paths.intermediateDir,
      language: options.language
    });
  }

  await analyzeCommand({
    repo,
    codegraphContext: resolvedContextPath,
    out: paths.outputPath,
    lens: "codegraph-assisted",
    full: options.full,
    review: options.review,
    language: options.language
  });

  await validateCommand({
    input: paths.outputPath,
    kind: "document"
  });

  if (options.noServe) {
    return {
      workspaceDir: paths.workspaceDir,
      outputPath: paths.outputPath
    };
  }

  const previewUrl = await serveCommand({
    data: paths.outputPath
  });

  return {
    workspaceDir: paths.workspaceDir,
    outputPath: paths.outputPath,
    previewUrl
  };
}
