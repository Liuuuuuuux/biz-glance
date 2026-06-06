import {
  analyzeCodeGraphContext,
  analyzeJavaSpringProject,
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
  type CloneGitHubRepository,
  type PreparedRepositoryInput
} from "../utils/repoInput";

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

export async function runAnalyzeCommand(options: {
  sample?: string;
  repo?: string;
  out: string;
  lens?: string;
  codegraphContext?: string;
  cloneGitHubRepository?: CloneGitHubRepository;
  prepareRepositoryInput?: (
    repo: string,
    resolveLocalPath: (targetPath: string) => string,
    clone?: CloneGitHubRepository
  ) => Promise<PreparedRepositoryInput>;
  writeDocument?: (filePath: string, document: BizGlanceDocument) => Promise<void>;
  readTextFile?: (filePath: string) => Promise<string>;
}) {
  if ((!options.sample && !options.repo) || (options.sample && options.repo)) {
    throw new Error("必须且只能提供 --sample 或 --repo 其中一个参数。");
  }

  const writeBizGlanceDocument = options.writeDocument ?? writeDocument;

  if (options.sample) {
    await writeBizGlanceDocument(resolveFromInitCwd(options.out), getSampleDocument(options.sample as SampleName));
    return;
  }

  const prepareRepositoryInput = options.prepareRepositoryInput ?? prepareRepositoryInputDefault;
  const repository = await prepareRepositoryInput(
    options.repo!,
    resolveFromInitCwd,
    options.cloneGitHubRepository
  );

  try {
    let document: BizGlanceDocument;

    if (options.lens === "codegraph-assisted") {
      if (!options.codegraphContext) {
        throw new Error("使用 codegraph-assisted lens 时必须提供 --codegraph-context。");
      }

      const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));
      const contextPath = resolveFromInitCwd(options.codegraphContext);
      const contextInput = JSON.parse(await readTextFile(contextPath)) as Omit<
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
    } else {
      document = await analyzeJavaSpringProject(repository.root);
    }

    document.meta.source.name = repository.displayName;
    document.meta.source.path = repository.sourcePath;

    if (repository.isRemote) {
      document.evidences = document.evidences.map((item) => ({
        ...item,
        filePath: item.filePath ? repository.normalizeEvidencePath(item.filePath) : item.filePath
      }));
    }

    await writeBizGlanceDocument(resolveFromInitCwd(options.out), document);
  } finally {
    await repository.cleanup();
  }
}
