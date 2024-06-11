import pathBuilder from 'path';
import fs from 'fs';

function findRootPath(startPath: string, count = 0): string | null {
  if (!fs.existsSync(startPath)) {
    return null;
  }
  const hasPmnpsModule = fs.existsSync(
    pathBuilder.join(startPath, 'node_modules', 'pmnps')
  );
  if (hasPmnpsModule) {
    return startPath;
  }
  if (startPath === '/' || startPath.endsWith(':\\')) {
    return null;
  }
  if (count === 10) {
    return null;
  }
  return findRootPath(pathBuilder.join(startPath, '..'), count + 1);
}

function join(...args: (string | null | undefined)[]) {
  const params = args.filter((d): d is string => !!d);
  return pathBuilder.join(...params);
}

function runtimePath() {
  if (global.pmnps.cwd) {
    return global.pmnps.cwd;
  }
  const cwd = process.cwd();
  const cwdPath = global.pmnps.isDevelopment
    ? join(cwd, 'test')
    : findRootPath(cwd) || cwd;
  global.pmnps.cwd = cwdPath;
  return cwdPath;
}

export const path = {
  join,
  cwd: runtimePath
};
