import { spawn } from "node:child_process";
import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_WEB_PORT = 4173;
const DEFAULT_DATA_PATH = "dist/bizglance.json";

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

export function buildWebDataUrl(dataPath: string) {
  const encoded = encodeURIComponent(dataPath);
  return `http://localhost:${DEFAULT_WEB_PORT}/?data=${encoded}`;
}

export function resolveServeDataPath(dataPath?: string) {
  return resolveFromInitCwd(dataPath ?? DEFAULT_DATA_PATH);
}

export async function runServeCommand(options: { data?: string }) {
  const resolvedDataPath = resolveServeDataPath(options.data);
  await access(resolvedDataPath);

  const workspaceRoot = process.env.INIT_CWD ?? "E:/code/biz-glance";
  const target = resolve(workspaceRoot, "packages/web/public/current.bizglance.json");
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolvedDataPath, target);

  const child = spawn("pnpm", [
    "--filter",
    "@bizglance/web",
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(DEFAULT_WEB_PORT),
    "--strictPort"
  ], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true
  });

  child.on("error", (error) => {
    console.error("启动 Web 预览失败:", error);
  });

  return buildWebDataUrl("/current.bizglance.json");
}
