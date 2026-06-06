import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CloneGitHubRepository = (cloneUrl: string, targetPath: string) => Promise<void>;
export type DownloadGitHubArchive = (archiveUrl: string, targetPath: string) => Promise<void>;
export type ExtractGitHubArchive = (archivePath: string, targetPath: string) => Promise<void>;

export type RepositoryFetchers = {
  clone: CloneGitHubRepository;
  downloadArchive: DownloadGitHubArchive;
  extractArchive: ExtractGitHubArchive;
};

export type GitHubRepositoryReference = {
  owner: string;
  repo: string;
  displayName: string;
  cloneUrl: string;
  archiveUrl: string;
};

export type PreparedRepositoryInput = {
  root: string;
  displayName: string;
  sourcePath: string;
  isRemote: boolean;
  cleanup: () => Promise<void>;
  normalizeEvidencePath: (filePath: string) => string;
};

function normalizeRepoName(repo: string) {
  return repo.replace(/\.git$/i, "");
}

function buildGitHubReference(owner: string, repo: string): GitHubRepositoryReference | null {
  const normalizedOwner = owner.trim();
  const normalizedRepo = normalizeRepoName(repo.trim());

  if (
    !/^[A-Za-z0-9_.-]+$/.test(normalizedOwner) ||
    !/^[A-Za-z0-9_.-]+$/.test(normalizedRepo)
  ) {
    return null;
  }

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
    displayName: `${normalizedOwner}/${normalizedRepo}`,
    cloneUrl: `https://github.com/${normalizedOwner}/${normalizedRepo}.git`,
    archiveUrl: `https://codeload.github.com/${normalizedOwner}/${normalizedRepo}/tar.gz/HEAD`
  };
}

export function parseGitHubRepository(value: string): GitHubRepositoryReference | null {
  const input = value.trim();
  const httpsMatch = input.match(
    /^https?:\/\/github\.com\/([^/\s?#]+)\/([^/\s?#]+)(?:[/?#].*)?$/i
  );

  if (httpsMatch) {
    return buildGitHubReference(httpsMatch[1], httpsMatch[2]);
  }

  const sshMatch = input.match(/^git@github\.com:([^/\s?#]+)\/([^/\s?#]+)$/i);

  if (sshMatch) {
    return buildGitHubReference(sshMatch[1], sshMatch[2]);
  }

  const sshUrlMatch = input.match(
    /^ssh:\/\/git@github\.com\/([^/\s?#]+)\/([^/\s?#]+)(?:[/?#].*)?$/i
  );

  if (sshUrlMatch) {
    return buildGitHubReference(sshUrlMatch[1], sshUrlMatch[2]);
  }

  return null;
}

export async function cloneGitHubRepository(cloneUrl: string, targetPath: string) {
  await execFileAsync("git", ["clone", "--depth", "1", cloneUrl, targetPath], {
    maxBuffer: 1024 * 1024 * 8,
    timeout: 120_000
  });
}

export async function downloadGitHubArchive(archiveUrl: string, targetPath: string) {
  const response = await fetch(archiveUrl, {
    headers: {
      "User-Agent": "bizglance-cli"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const archiveBuffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, archiveBuffer);
}

export async function extractGitHubArchive(archivePath: string, targetPath: string) {
  await mkdir(targetPath, { recursive: true });
  await execFileAsync("tar", ["-xzf", archivePath, "-C", targetPath, "--strip-components", "1"], {
    maxBuffer: 1024 * 1024 * 8,
    timeout: 120_000
  });
}

function normalizeFetchers(fetchers?: CloneGitHubRepository | Partial<RepositoryFetchers>) {
  if (typeof fetchers === "function") {
    return {
      clone: fetchers,
      downloadArchive: downloadGitHubArchive,
      extractArchive: extractGitHubArchive
    };
  }

  return {
    clone: fetchers?.clone ?? cloneGitHubRepository,
    downloadArchive: fetchers?.downloadArchive ?? downloadGitHubArchive,
    extractArchive: fetchers?.extractArchive ?? extractGitHubArchive
  };
}

function toRepoRelativePath(root: string, filePath: string) {
  const repoRelativePath = relative(root, filePath);

  if (
    !repoRelativePath ||
    repoRelativePath.startsWith("..") ||
    isAbsolute(repoRelativePath)
  ) {
    return filePath;
  }

  return repoRelativePath.replace(/\\/g, "/");
}

export async function prepareRepositoryInput(
  repo: string,
  resolveLocalPath: (targetPath: string) => string,
  fetchers?: CloneGitHubRepository | Partial<RepositoryFetchers>
): Promise<PreparedRepositoryInput> {
  const githubRepository = parseGitHubRepository(repo);

  if (!githubRepository) {
    const root = resolveLocalPath(repo);

    return {
      root,
      displayName: root.split(/[\\/]/).filter(Boolean).at(-1) ?? root,
      sourcePath: root,
      isRemote: false,
      cleanup: async () => {},
      normalizeEvidencePath: (filePath) => filePath
    };
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "bizglance-github-"));
  const cloneRoot = join(tempRoot, githubRepository.repo);
  const archivePath = join(tempRoot, `${githubRepository.repo}.tar.gz`);
  const repositoryFetchers = normalizeFetchers(fetchers);

  try {
    try {
      await repositoryFetchers.clone(githubRepository.cloneUrl, cloneRoot);
    } catch (cloneError) {
      try {
        await repositoryFetchers.downloadArchive(githubRepository.archiveUrl, archivePath);
        await repositoryFetchers.extractArchive(archivePath, cloneRoot);
      } catch (archiveError) {
        const cloneMessage = cloneError instanceof Error ? cloneError.message : String(cloneError);
        const archiveMessage =
          archiveError instanceof Error ? archiveError.message : String(archiveError);
        throw new Error(
          `克隆 GitHub 仓库失败：${cloneMessage}；下载 GitHub archive 也失败：${archiveMessage}`
        );
      }
    }
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    root: cloneRoot,
    displayName: githubRepository.displayName,
    sourcePath: githubRepository.cloneUrl,
    isRemote: true,
    cleanup: async () => {
      await rm(tempRoot, { recursive: true, force: true });
    },
    normalizeEvidencePath: (filePath) => toRepoRelativePath(cloneRoot, filePath)
  };
}
