import {
  analyzeJavaSpringProject,
  getSampleDocument,
  writeDocument,
  type SampleName
} from "../../../core/src/index";
import { resolve } from "node:path";

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
}) {
  if ((!options.sample && !options.repo) || (options.sample && options.repo)) {
    throw new Error("必须且只能提供 --sample 或 --repo 其中一个参数。");
  }

  const document = options.sample
    ? getSampleDocument(options.sample as SampleName)
    : await analyzeJavaSpringProject(options.repo!);

  await writeDocument(resolveFromInitCwd(options.out), document);
}
