import { file, path } from '@/libs';
import { CONF_NAME } from '@/constants';
import type { Config } from '@pmnps/tools';

function readConfig(cwd: string) {
  const configPath = path.join(cwd, CONF_NAME);
  return file.readJson<Config>(configPath);
}

function writeConfig(cwd: string, config: Config) {
  const configPath = path.join(cwd, CONF_NAME);
  return file.writeJson(configPath, config);
}

export const configure = {
  readConfig,
  writeConfig
};
