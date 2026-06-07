import {
  analyzeCodeGraphContext,
  getSampleDocument,
  validateCompleteBizGlanceDocument,
  validateCodeGraphAssistedAnalysisInput,
  writeDocument,
  type BizGlanceDocument,
  type CodeGraphAssistedAnalysisInput,
  type SampleName
} from "../../../core/src/index";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  prepareRepositoryInput as prepareRepositoryInputDefault,
  type PreparedRepositoryInput
} from "../utils/repoInput";

const execFileAsync = promisify(execFile);

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

const DEFAULT_OUT = "dist/bizglance.json";

function normalizePathForJson(targetPath: string) {
  return targetPath.replace(/\\/g, "/");
}

async function defaultWriteTextFile(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function defaultReadGitCommit(repoPath: string) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, "rev-parse", "HEAD"]);
    const commit = stdout.trim();

    return commit.length > 0 ? commit : undefined;
  } catch {
    return undefined;
  }
}

function buildMetaPath(outputPath: string) {
  if (!outputPath.replace(/\\/g, "/").includes("/.bizglance/")) {
    return undefined;
  }

  return resolve(dirname(outputPath), "meta.json");
}

function buildIntermediateInputPath(outputPath: string) {
  if (!outputPath.replace(/\\/g, "/").includes("/.bizglance/")) {
    return undefined;
  }

  return resolve(dirname(outputPath), "intermediate", "codegraph-assisted-input.json");
}

export async function runAnalyzeCommand(options: {
  sample?: string;
  repo?: string;
  context?: string;
  out?: string;
  lens?: string;
  codegraphContext?: string;
  prepareRepositoryInput?: (
    repo: string,
    resolveLocalPath: (targetPath: string) => string
  ) => Promise<PreparedRepositoryInput>;
  writeDocument?: (filePath: string, document: BizGlanceDocument) => Promise<void>;
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
  readTextFile?: (filePath: string) => Promise<string>;
  readGitCommit?: (repoPath: string) => Promise<string | undefined>;
  now?: () => string;
  transformDocument?: (document: BizGlanceDocument) => Promise<BizGlanceDocument> | BizGlanceDocument;
}) {
  const contextPath = options.codegraphContext ?? options.context;
  const repo = options.repo ?? (!options.sample && contextPath ? "." : undefined);

  if ((!options.sample && !repo) || (options.sample && repo)) {
    throw new Error("必须且只能提供 --sample 或仓库路径其中一个参数。");
  }

  const writeBizGlanceDocument = options.writeDocument ?? writeDocument;
  const outputPath = resolveFromInitCwd(options.out ?? DEFAULT_OUT);

  if (options.sample) {
    await writeBizGlanceDocument(outputPath, getSampleDocument(options.sample as SampleName));
    return;
  }

  const prepareRepositoryInput = options.prepareRepositoryInput ?? prepareRepositoryInputDefault;
  const repository = await prepareRepositoryInput(
    repo!,
    resolveFromInitCwd
  );

  try {
    let document: BizGlanceDocument;

    if (options.lens && options.lens !== "codegraph-assisted") {
      throw new Error("当前仅支持 codegraph-assisted lens。");
    }

    if (!contextPath) {
      throw new Error("分析仓库时必须提供 --context。");
    }

    const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));
    const writeTextFile = options.writeTextFile ?? defaultWriteTextFile;
    const resolvedContextPath = resolveFromInitCwd(contextPath);
    const contextInput = JSON.parse(await readTextFile(resolvedContextPath)) as Omit<
      CodeGraphAssistedAnalysisInput,
      "source"
    >;
    const validation = validateCodeGraphAssistedAnalysisInput(contextInput);

    if (!validation.valid) {
      throw new Error(
        `CodeGraph-assisted 输入校验失败:\n${validation.errors
          .map((error) => `- ${error}`)
          .join("\n")}`
      );
    }

    const intermediateInputPath = buildIntermediateInputPath(outputPath);

    if (intermediateInputPath) {
      await writeTextFile(intermediateInputPath, `${JSON.stringify(contextInput, null, 2)}\n`);
    }

    document = analyzeCodeGraphContext({
      ...contextInput,
      source: {
        name: repository.displayName,
        path: repository.sourcePath
      }
    });

    document.meta.source.name = repository.displayName;
    document.meta.source.path = repository.sourcePath;

    if (options.transformDocument) {
      document = await options.transformDocument(document);
    }

    const documentValidation = validateCompleteBizGlanceDocument(document);

    if (!documentValidation.valid) {
      throw new Error(
        `BizGlance 文档校验失败:\n${documentValidation.errors
          .map((error) => `- ${error}`)
          .join("\n")}`
      );
    }

    await writeBizGlanceDocument(outputPath, document);

    const metaPath = buildMetaPath(outputPath);

    if (metaPath) {
      const readGitCommit = options.readGitCommit ?? defaultReadGitCommit;
      const generatedAt = options.now?.() ?? document.meta.generatedAt;

      await writeTextFile(
        metaPath,
        `${JSON.stringify(
          {
            version: document.meta.version,
            generatedAt,
            gitCommit: await readGitCommit(repository.sourcePath),
            source: {
              name: repository.displayName,
              path: normalizePathForJson(repository.sourcePath)
            },
            contextPath: normalizePathForJson(resolvedContextPath),
            outputPath: normalizePathForJson(outputPath),
            warnings: document.meta.warnings
          },
          null,
          2
        )}\n`
      );
    }
  } finally {
    await repository.cleanup();
  }
}
