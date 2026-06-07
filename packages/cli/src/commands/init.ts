import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_CONFIG = {
  language: "zh",
  autoServe: true,
  defaultLens: "codegraph-assisted"
};

const DEFAULT_GITIGNORE = [
  "bizglance.json",
  "meta.json",
  "intermediate/",
  "tmp/",
  ""
].join("\n");

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeFileIfMissing(path: string, content: string) {
  if (await exists(path)) {
    return false;
  }

  await writeFile(path, content, "utf8");
  return true;
}

export interface InitResult {
  repo: string;
  workspaceDir: string;
  createdConfig: boolean;
}

export async function runInitCommand(options: { repo?: string } = {}): Promise<InitResult> {
  const repo = resolveFromInitCwd(options.repo ?? ".");

  if (!(await exists(repo))) {
    throw new Error(`目标目录不存在: ${repo}`);
  }

  const workspaceDir = resolve(repo, ".bizglance");
  const intermediateDir = resolve(workspaceDir, "intermediate");
  const tmpDir = resolve(workspaceDir, "tmp");

  await mkdir(intermediateDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const createdConfig = await writeFileIfMissing(
    resolve(workspaceDir, "config.json"),
    `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`
  );

  await writeFileIfMissing(resolve(workspaceDir, ".gitignore"), DEFAULT_GITIGNORE);
  await writeFileIfMissing(resolve(intermediateDir, ".gitkeep"), "");
  await writeFileIfMissing(resolve(tmpDir, ".gitkeep"), "");
  await writeFileIfMissing(
    resolve(workspaceDir, "meta.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), warnings: [] }, null, 2)}\n`
  );

  await readFile(resolve(workspaceDir, "config.json"), "utf8");

  return {
    repo,
    workspaceDir,
    createdConfig
  };
}
