export type PreparedRepositoryInput = {
  root: string;
  displayName: string;
  sourcePath: string;
  cleanup: () => Promise<void>;
};

function isRemoteRepositoryReference(value: string) {
  return /^(https?:\/\/|git@|ssh:\/\/)/i.test(value.trim());
}

export async function prepareRepositoryInput(
  repo: string,
  resolveLocalPath: (targetPath: string) => string
): Promise<PreparedRepositoryInput> {
  if (isRemoteRepositoryReference(repo)) {
    throw new Error("只支持本地仓库路径，请先在本地 clone 后再分析。");
  }

  const root = resolveLocalPath(repo);

  return {
    root,
    displayName: root.split(/[\\/]/).filter(Boolean).at(-1) ?? root,
    sourcePath: root,
    cleanup: async () => {}
  };
}
