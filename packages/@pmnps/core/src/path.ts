import fs from 'fs';
import pathBuilder from 'path';
import { IS_DEV } from './process';
import {PACKAGE_DIR_NAME, platformDirName} from "./define";

function findRootPath(startPath: string, count: number = 0): string | null {
  if (!fs.existsSync(startPath)) {
    return null;
  }
  const hasPmnpsConfig = fs.existsSync(
    pathBuilder.join(startPath, '.pmnpsrc.json')
  );
  if (hasPmnpsConfig) {
    return startPath;
  }
  if (startPath === '/' || startPath.endsWith(':\\')) {
    return null;
  }
  if (count === 20) {
    return null;
  }
  return findRootPath(pathBuilder.join(startPath, '..'), count + 1);
}

function join(...args: (string | null | undefined)[]) {
  const params = args.filter((d): d is string => !!d);
  return pathBuilder.join(...params);
}

function root() {
  if (global.pmnps && global.pmnps.rootPath) {
    return global.pmnps.rootPath;
  }
  const cwd = process.cwd();
  const actualRootPath = findRootPath(cwd) || cwd;
  const rootPath = IS_DEV ? join(cwd, 'test') : actualRootPath;
  global.pmnps = global.pmnps || {};
  global.pmnps.rootPath = rootPath;
  return rootPath;
}

const rootPath = root();

const packagesPath = ()=>join(rootPath, PACKAGE_DIR_NAME);

const platformsPath = ()=>join(rootPath, platformDirName());

export { join };

export default { rootPath, packagesPath, platformsPath, join };
