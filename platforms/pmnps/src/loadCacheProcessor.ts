import { cache } from '@/cache';
import { projectSupport } from '@/support';
import type { Project, State } from '@/types';

async function loadCacheProject(cwd: string): Promise<Project | undefined> {
  const serial = await cache.readProject(cwd);
  if (serial == null) {
    return serial;
  }
  try {
    return projectSupport.parse(serial);
  } catch (e) {
    return undefined;
  }
}

function loadCacheCommands(
  cwd: string
): Promise<Record<string, Record<string, any>> | undefined> {
  return cache.readCommands(cwd);
}

export async function loadCacheData(cwd: string) {
  const [cacheProject, commands] = await Promise.all([
    loadCacheProject(cwd),
    loadCacheCommands(cwd)
  ]);
  return { cacheProject, commands } as State;
}
