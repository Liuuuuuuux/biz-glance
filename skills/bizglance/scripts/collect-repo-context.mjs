import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_IGNORE_DIRS = new Set([
  ".bizglance",
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);
const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".java", ".js", ".jsx", ".mjs", ".mts", ".py", ".ts", ".tsx"]);
const MANIFEST_FILES = new Set(["package.json", "pom.xml", "build.gradle", "build.gradle.kts", "pyproject.toml"]);
const MAX_FILES = 500;
const MAX_README_CHARS = 1000;

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function relativePath(repoRoot, filePath) {
  return normalizePath(relative(repoRoot, filePath));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root, current = root, files = []) {
  if (files.length >= MAX_FILES) {
    return files;
  }

  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (files.length >= MAX_FILES) {
      break;
    }

    if (entry.isDirectory()) {
      if (!DEFAULT_IGNORE_DIRS.has(entry.name)) {
        await walkFiles(root, resolve(current, entry.name), files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(resolve(current, entry.name));
    }
  }

  return files;
}

async function readMaybe(filePath, maxChars = 10000) {
  try {
    const content = await readFile(filePath, "utf8");
    return content.slice(0, maxChars);
  } catch {
    return undefined;
  }
}

async function collectReadme(repoRoot) {
  for (const name of ["README.md", "readme.md", "README.txt"]) {
    const filePath = resolve(repoRoot, name);
    const content = await readMaybe(filePath, MAX_README_CHARS);

    if (content) {
      return {
        path: name,
        summary: content.replace(/\s+/g, " ").trim().slice(0, 500)
      };
    }
  }

  return undefined;
}

async function collectManifest(repoRoot, filePath) {
  const name = basename(filePath);
  const relPath = relativePath(repoRoot, filePath);

  if (name === "package.json") {
    try {
      const manifest = JSON.parse(await readFile(filePath, "utf8"));
      return {
        path: relPath,
        name: typeof manifest.name === "string" ? manifest.name : undefined,
        dependencies: Object.keys({
          ...(manifest.dependencies ?? {}),
          ...(manifest.devDependencies ?? {})
        }).sort()
      };
    } catch {
      return {
        path: relPath
      };
    }
  }

  return {
    path: relPath
  };
}

function detectSymbols(content) {
  const symbols = [];
  const patterns = [
    /\bclass\s+([A-Z][A-Za-z0-9_]*)/g,
    /\binterface\s+([A-Z][A-Za-z0-9_]*)/g,
    /\btype\s+([A-Z][A-Za-z0-9_]*)/g,
    /\benum\s+([A-Z][A-Za-z0-9_]*)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      symbols.push(match[1]);
    }
  }

  return symbols;
}

function findLine(content, needle) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  return index >= 0 ? index + 1 : undefined;
}

function collectEntrypoints(repoRoot, filePath, content) {
  const relPath = relativePath(repoRoot, filePath);
  const name = basename(filePath, extname(filePath));
  const items = [];
  const lowerName = name.toLowerCase();

  if (/(controller|route|router|handler|endpoint)/i.test(name)) {
    items.push({
      filePath: relPath,
      kind: lowerName.includes("controller") ? "controller" : "route",
      symbol: detectSymbols(content)[0] ?? name,
      line: findLine(content, "class ") ?? findLine(content, "router") ?? findLine(content, "route")
    });
  }

  const routeMatches = content.matchAll(/["'`]((?:\/api)?\/[A-Za-z0-9_/:.-]+)["'`]/g);
  for (const match of routeMatches) {
    items.push({
      filePath: relPath,
      kind: "route",
      route: match[1],
      line: findLine(content, match[1])
    });
  }

  return items;
}

function collectEntityCandidates(repoRoot, filePath, content) {
  const relPath = relativePath(repoRoot, filePath);
  const name = basename(filePath, extname(filePath));
  const symbols = detectSymbols(content);
  const fileLooksLikeEntity = /(entity|model|domain|dto|schema)/i.test(filePath) || /^[A-Z][A-Za-z0-9_]+$/.test(name);

  if (!fileLooksLikeEntity) {
    return [];
  }

  return (symbols.length > 0 ? symbols : [name])
    .filter((symbol) => !/(Controller|Service|Repository|Mapper|Route|Router|Handler)$/.test(symbol))
    .map((symbol) => ({
      filePath: relPath,
      technicalName: symbol,
      line: findLine(content, symbol)
    }));
}

function collectStatusCandidates(repoRoot, filePath, content) {
  const relPath = relativePath(repoRoot, filePath);
  const items = [];
  const statusPatterns = [
    /\b(status|state|phase)\b\s*[:=]/gi,
    /\b(orderStatus|paymentStatus|workflowState)\b\s*[:=]/gi
  ];

  for (const pattern of statusPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      items.push({
        filePath: relPath,
        field: match[1],
        line: findLine(content, match[1])
      });
    }
  }

  return items;
}

function collectFieldCandidates(repoRoot, filePath, content) {
  const relPath = relativePath(repoRoot, filePath);
  const fields = [];
  const patterns = [
    /^\s*(?:public|private|protected)?\s*(?:readonly\s+)?([a-z][A-Za-z0-9_]*)\??\s*[:=]/gm,
    /^\s*(?:private|protected|public)?\s+[A-Za-z0-9_<>,.?]+\s+([a-z][A-Za-z0-9_]*)\s*[;=]/gm
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      fields.push({
        filePath: relPath,
        field: match[1],
        line: findLine(content, match[1])
      });
    }
  }

  return fields;
}

export async function collectRepoContext(options) {
  const repoRoot = resolve(options.repo ?? ".");
  const output = resolve(options.output ?? resolve(repoRoot, ".bizglance/intermediate/repo-context.json"));

  if (!(await pathExists(repoRoot))) {
    throw new Error(`目标仓库不存在: ${repoRoot}`);
  }

  const files = await walkFiles(repoRoot);
  const sourceFiles = files.filter((filePath) => SOURCE_EXTENSIONS.has(extname(filePath)));
  const manifests = [];
  const entrypoints = [];
  const entityCandidates = [];
  const statusCandidates = [];
  const fieldCandidates = [];

  for (const filePath of files) {
    if (MANIFEST_FILES.has(basename(filePath))) {
      manifests.push(await collectManifest(repoRoot, filePath));
    }
  }

  for (const filePath of sourceFiles) {
    const content = await readMaybe(filePath);
    if (!content) {
      continue;
    }

    entrypoints.push(...collectEntrypoints(repoRoot, filePath, content));
    entityCandidates.push(...collectEntityCandidates(repoRoot, filePath, content));
    statusCandidates.push(...collectStatusCandidates(repoRoot, filePath, content));
    fieldCandidates.push(...collectFieldCandidates(repoRoot, filePath, content));
  }

  const context = {
    version: "0.1.0",
    generatedAt: new Date().toISOString(),
    repo: {
      name: manifests.find((item) => item.name)?.name ?? basename(repoRoot),
      root: normalizePath(repoRoot)
    },
    readme: await collectReadme(repoRoot),
    manifests,
    stats: {
      fileCount: files.length,
      sourceFileCount: sourceFiles.length
    },
    entrypoints: uniqueBy(entrypoints, (item) => `${item.filePath}:${item.kind}:${item.symbol ?? item.route ?? ""}`),
    entityCandidates: uniqueBy(entityCandidates, (item) => `${item.filePath}:${item.technicalName}`),
    statusCandidates: uniqueBy(statusCandidates, (item) => `${item.filePath}:${item.field}:${item.line ?? ""}`),
    fieldCandidates: uniqueBy(fieldCandidates, (item) => `${item.filePath}:${item.field}:${item.line ?? ""}`)
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(context, null, 2)}\n`, "utf8");

  return context;
}

async function main() {
  const [, , repoArg = ".", outputArg] = process.argv;
  await collectRepoContext({
    repo: repoArg,
    output: outputArg
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
