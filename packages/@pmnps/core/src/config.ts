import fs from 'fs';
import path from './path';
import { Config, PackageJson } from './type';
import { readFile, readJson, writeJson } from '@pmnps/core/src/file';

const rootConfigName = '.pmnpsrc.json';

const configPath = path.join(path.rootPath, rootConfigName);

function getPmnpsConfig(): Config | null {
  if (!global.pmnps) {
    return null;
  }
  return global.pmnps.config || null;
}

function setPmnpsConfig(config: Config): void {
  global.pmnps.config = config;
}

async function loadConfig(): Promise<Config | null> {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const config = await readJson<Config>(configPath);
  if(!config){
    return null;
  }
  setPmnpsConfig(config);
  return config;
}

function readConfig(): Config | null {
  const config = getPmnpsConfig();
  if (config) {
    return config;
  }
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const data = fs.readFileSync(configPath);
  const content = data.toString('utf-8');
  const c = JSON.parse(content) as Config;
  setPmnpsConfig(c);
  return c;
}

function writeConfig(config: Partial<Config>): void {
  const source = readConfig();
  setPmnpsConfig((source ? { ...source, ...config } : config) as Config);
}

async function flushConfig(): Promise<void> {
  const content = getPmnpsConfig();
  if (content == null) {
    return;
  }
  await writeJson(configPath, content);
}

export { loadConfig, readConfig, writeConfig, flushConfig };

export default { loadConfig, readConfig, writeConfig, flushConfig };
