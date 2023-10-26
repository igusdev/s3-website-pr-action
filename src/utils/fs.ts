import { readdir, stat } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

export const readRecursively = async (dir: string): Promise<string[]> => {
  const dirContent = await promisify(readdir)(dir);

  return dirContent.reduce(
    async (foundFiles, fileOrDir) => {
      const path = join(dir, fileOrDir);
      const files = await foundFiles;

      if ((await promisify(stat)(path)).isDirectory()) {
        return files.concat(await readRecursively(path));
      }

      return files.concat(path);
    },
    Promise.resolve([] as string[]),
  );
};
