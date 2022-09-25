import fs from 'fs';
import path from './path';
import { LocalCache } from './type';
import { readJson, writeJson } from './file';

const rootLocalName = '.pmnps.local.json';

const localPath = path.join(path.rootPath, rootLocalName);

function getPmnpsLocal(): LocalCache | null {
  if (!global.pmnps) {
    return null;
  }
  return global.pmnps.local || null;
}

function setPmnpsLocal(local: LocalCache): void {
  global.pmnps.local = local;
}

async function loadCache(): Promise<LocalCache | null> {
  if (!fs.existsSync(localPath)) {
    return null;
  }

  const cache = await readJson<LocalCache>(localPath);
  if (!cache) {
    return null;
  }
  setPmnpsLocal(cache);
  return cache;
}

function readCache(): LocalCache | null {
  const cache = getPmnpsLocal();
  if (cache) {
    return cache;
  }
  if (!fs.existsSync(localPath)) {
    return null;
  }
  const data = fs.readFileSync(localPath);
  const content = data.toString('utf-8');
  const c = JSON.parse(content) as LocalCache;
  setPmnpsLocal(c);
  return c;
}

function writeCache(cache: Partial<LocalCache>): void {
  const source = readCache();
  setPmnpsLocal((source ? { ...source, ...cache } : cache) as LocalCache);
}

async function flushCache(): Promise<void> {
  const content = getPmnpsLocal();
  if (content == null) {
    return;
  }
  await writeJson(localPath, content);
}

export { loadCache, readCache, writeCache, flushCache };

export default { loadCache, readCache, writeCache, flushCache };
