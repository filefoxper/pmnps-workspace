import process from 'process';
import { requireFactory } from '@pmnps/tools';
import { version, message, path } from '@/libs';
import { hold } from '@/state';
import { configure } from '@/support';
import { getPluginRequireState } from '@/plugin';
import { loadCacheData } from '@/loadCacheProcessor';
import { loadData } from '@/loadProcessor';
import type { Plugin, Command } from '@pmnps/tools';
import type { Template } from '@/types';

function checkRuntimeEnv(): string | null {
  const nodeVersion = process.version;
  const nodeV = nodeVersion.startsWith('v')
    ? nodeVersion.slice(1)
    : nodeVersion;
  if (version.compare(nodeV, '16.7.0').lt()) {
    message.error('Pmnps needs nodejs version >= 16.7.0');
    return null;
  }
  return `Env: node@${nodeV}`;
}

export async function loadProject(withCache?: boolean) {
  const cwd = path.cwd();
  if (withCache) {
    const [projectState, cacheProjectState] = await Promise.all([
      loadData(cwd),
      loadCacheData(cwd)
    ]);
    return { ...projectState, ...cacheProjectState };
  }
  return loadData(cwd);
}

async function loadPlugins(
  cwd: string,
  plugins: (string | [string, Record<string, any>])[]
) {
  const factory = requireFactory(cwd);
  return Promise.all(
    plugins.map(async pluginSetting => {
      const name =
        typeof pluginSetting === 'string' ? pluginSetting : pluginSetting[0];
      const setting =
        typeof pluginSetting === 'string' ? undefined : pluginSetting[1];
      const pluginModule = await factory.require(name);
      if (pluginModule.module == null) {
        return null;
      }
      const plugin = pluginModule.module.default as Plugin<any>;
      return plugin(setting);
    })
  );
}

function loadTemplates(cwd: string, templates: string[]) {
  return templates.map(name => {
    const names = name.split('/');
    const requiredPathname = path.join(cwd, 'node_modules', ...names);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const temp = require(requiredPathname).default as Template;
    return { ...temp, name };
  });
}

async function loadConfig() {
  const cwd = path.cwd();
  const config = await configure.readConfig(cwd);
  const { templates = [], plugins = [] } = config ?? {};
  const commands = await loadPlugins(cwd, plugins);
  return {
    config,
    resources: {
      templates: loadTemplates(cwd, templates),
      commands: commands.filter((c): c is Command => !!c)
    }
  };
}

function loadPluginRequires() {
  const state = getPluginRequireState();
  const commands = hold.instance().getCommands();
  commands.forEach(command => {
    if (!command.require) {
      return;
    }
    command.require(state, command.options);
  });
}

async function load() {
  const holder = hold.instance();
  const loading = holder.load(true);
  const fetchingConfig = loadConfig();
  const partState = await loading;
  const { config, resources } = await fetchingConfig;
  holder.setState({ ...partState, config });
  holder.setResources(resources);
  loadPluginRequires();
}

export async function initialize() {
  message.info(global.pmnps.px ? 'Pmnpx startup...' : 'Pmnps startup...');
  const versions = checkRuntimeEnv();
  if (!versions) {
    return false;
  }
  message.desc(versions);
  await load();
  return true;
}
