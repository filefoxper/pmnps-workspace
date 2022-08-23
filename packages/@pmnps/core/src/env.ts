import execa from 'execa';
import { IS_DEV, IS_WINDOWS } from './process';
import { mkdirIfNotExist } from './file';
import path from './path';
import { loadConfig } from './config';
import { build } from './structure';
import { loadPlugins } from './plugin';
import { loadTemplates } from '@pmnps/core/src/template';

function versionStringToNums(version: string) {
  return version.split('.').slice(0, 3).map(Number);
}

function versionCompare(v1: string, v2: string): boolean {
  const limitVersions = versionStringToNums(v2);
  const currentVersions = versionStringToNums(v1);
  const result = limitVersions.reduce((r: number, v: number, i: number) => {
    const c = currentVersions[i];
    if (r !== 0) {
      return r;
    }
    if (c > v) {
      return 1;
    }
    if (c < v) {
      return -1;
    }
    return 0;
  }, 0);
  return result >= 0;
}

async function isEnvSupport(): Promise<boolean> {
  const [node, npm] = await Promise.all([
    execa('node', ['-v']),
    execa('npm', ['-v'])
  ]);
  const nodeV = node.stdout;
  const npmV = npm.stdout;
  const nodeSupport = versionCompare(
    nodeV.startsWith('v') ? nodeV.slice(1) : nodeV,
    '16.7.0'
  );
  const npmSupport = versionCompare(
    npmV.startsWith('v') ? npmV.slice(1) : npmV,
    '7.7.0'
  );
  return nodeSupport && npmSupport;
}

async function initial(): Promise<boolean> {
  global.pmnps = global.pmnps || {};
  const support = await isEnvSupport();
  if (!support) {
    return false;
  }
  await loadConfig();
  await build();
  loadPlugins();
  loadTemplates();
  return true;
}

export { IS_DEV, IS_WINDOWS, initial, versionCompare, isEnvSupport };

export default {
  IS_DEV,
  IS_WINDOWS,
  initial,
  versionCompare,
  isEnvSupport
};
