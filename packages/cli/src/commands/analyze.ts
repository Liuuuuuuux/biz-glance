import {
  analyzeCodeGraphContext,
  getSampleDocument,
  writeDocument,
  type BizGlanceDocument,
  type CodeGraphAssistedAnalysisInput,
  type SampleName
} from "../../../core/src/index";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  prepareRepositoryInput as prepareRepositoryInputDefault,
  type PreparedRepositoryInput
} from "../utils/repoInput";

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

const DEFAULT_OUT = "dist/bizglance.json";

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
  readTextFile?: (filePath: string) => Promise<string>;
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
    const resolvedContextPath = resolveFromInitCwd(contextPath);
    const contextInput = JSON.parse(await readTextFile(resolvedContextPath)) as Omit<
      CodeGraphAssistedAnalysisInput,
      "source"
    >;

    document = analyzeCodeGraphContext({
      ...contextInput,
      source: {
        name: repository.displayName,
        path: repository.sourcePath
      }
    });

    document.meta.source.name = repository.displayName;
    document.meta.source.path = repository.sourcePath;

    await writeBizGlanceDocument(outputPath, document);
  } finally {
    await repository.cleanup();
  }
}
