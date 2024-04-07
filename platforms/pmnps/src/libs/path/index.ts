import pathBuilder from 'path';
import { env } from '../env';

function join(...args: (string | null | undefined)[]) {
  const params = args.filter((d): d is string => !!d);
  return pathBuilder.join(...params);
}

function runtimePath() {
  if (global.pmnps.cwd) {
    return global.pmnps.cwd;
  }
  const cwd = process.cwd();
  const cwdPath = env.isDevelopment ? join(cwd, 'test') : cwd;
  global.pmnps.cwd = cwdPath;
  return cwdPath;
}

export const path = {
  join,
  cwd: runtimePath
};
