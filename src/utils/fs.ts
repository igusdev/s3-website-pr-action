import { readdir, stat } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

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
