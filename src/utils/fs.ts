import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const readRecursively = async (dir: string): Promise<string[]> => {
  const dirContent = await readdir(dir);

  return dirContent.reduce(async (foundFiles, fileOrDir) => {
    const path = join(dir, fileOrDir);
    const files = await foundFiles;

    if ((await stat(path)).isDirectory()) {
      return files.concat(await readRecursively(path));
    }

    return files.concat(path);
  }, Promise.resolve([] as string[]));
};
