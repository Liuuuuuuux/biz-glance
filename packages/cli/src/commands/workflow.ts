import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runAnalyzeCommand } from "./analyze";
import { runInitCommand, type InitResult } from "./init";
import { runServeCommand } from "./serve";
import { runValidateCommand, type ValidateCommandResult } from "./validate";

const DEFAULT_WORKSPACE_DIR = ".bizglance";
const DEFAULT_OUTPUT_FILE = "bizglance.json";
const DEFAULT_INTERMEDIATE_INPUT_FILE = "codegraph-assisted-input.json";

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
    cachedInputPath: resolve(workspaceDir, "intermediate", DEFAULT_INTERMEDIATE_INPUT_FILE),
    repoRoot: repo
  };
}

export interface WorkflowCommandResult {
  workspaceDir: string;
  outputPath: string;
  previewUrl?: string;
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
  fileExists?: (filePath: string) => Promise<boolean>;
  readTextFile?: (filePath: string) => Promise<string>;
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
}): Promise<WorkflowCommandResult> {
  if (options.full && options.review) {
    throw new Error("不能同时使用 --full 和 --review。");
  }

  if (options.full && !options.codegraphContext) {
    throw new Error("full 模式必须提供 --context。");
  }

  const repo = resolveFromInitCwd(options.repo ?? ".");
  const initCommand = options.initCommand ?? runInitCommand;
  const analyzeCommand = options.analyzeCommand ?? runAnalyzeCommand;
  const validateCommand = options.validateCommand ?? runValidateCommand;
  const serveCommand = options.serveCommand ?? runServeCommand;
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

  const resolvedContextPath =
    options.codegraphContext ??
    (!(options.full) && (await fileExists(paths.cachedInputPath)) ? paths.cachedInputPath : undefined);

  if (!resolvedContextPath) {
    throw new Error("workflow 模式必须提供 --context，或先生成 .bizglance/intermediate/codegraph-assisted-input.json。");
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
