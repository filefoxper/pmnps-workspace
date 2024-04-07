import { file, mkdirIfNotExist, path } from '../libs';
import type { ProjectSerial } from '@/types';

function getCachePath(cwd: string) {
  return path.join(cwd, 'node_modules', '.cache', 'pmnps');
}

async function readCache<T extends Record<string, any>>(
  cwd: string,
  fileName: string
) {
  const cachePath = getCachePath(cwd);
  return file.readJson<T>(path.join(cachePath, fileName));
}

async function writeCache<T extends Record<string, any>>(
  cwd: string,
  fileName: string,
  data: T
) {
  const cachePath = getCachePath(cwd);
  await file.mkdirIfNotExist(cachePath);
  await file.writeJson(path.join(cachePath, fileName), data);
  return data;
}

async function readProject(cwd: string) {
  await mkdirIfNotExist(cwd);
  return readCache<ProjectSerial>(cwd, 'project.json');
}

async function writeProject(cwd: string, project: ProjectSerial) {
  await mkdirIfNotExist(cwd);
  return writeCache(cwd, 'project.json', project);
}

export const cache = {
  readProject,
  writeProject
};
