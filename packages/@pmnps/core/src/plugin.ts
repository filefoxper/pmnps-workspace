import inquirer from 'inquirer';
import { readConfig } from './config';
import { PluginComponent, PluginPack, PluginRender, PluginType } from './type';
import requires, { parseRequireName } from './require';

function writePlugin(pluginPacks: PluginPack[]) {
  if (!global.pmnps) {
    throw new Error('Here is a mistake for `pmnps` plugin loading.');
  }
  global.pmnps.plugin = pluginPacks;
}

function loadPlugins() {
  const { plugins = [] } = readConfig() || {};
  const pluginSources = plugins
    .filter(
      d =>
        typeof d === 'string' ||
        (Array.isArray(d) &&
          d.length >= 1 &&
          typeof d[0] === 'string' &&
          d[0].trim())
    )
    .map(pluginConfig => {
      const name =
        typeof pluginConfig === 'string' ? pluginConfig : pluginConfig[0];
      const query = Array.isArray(pluginConfig) ? pluginConfig[1] : undefined;
      return { name, query };
    });
  const pluginPacks = pluginSources.map(({ name, query }) => {
    const component: PluginComponent = require(parseRequireName(name)).default;
    const pack = component(query);
    return { ...pack, displayName: pack.displayName || name };
  });
  writePlugin(pluginPacks);
}

async function runPlugin(type: keyof PluginType): Promise<boolean> {
  if (!global.pmnps || !global.pmnps.plugin) {
    throw new Error('Here is a mistake for `pmnps` run plugin.');
  }
  const plugins = global.pmnps.plugin;
  const types = plugins.filter(({ renders }) => renders[type]);
  const options = types.filter(({ isOption }) => isOption);
  let ops: string[] = [];
  if (options.length) {
    const { plugins: opgs } = await inquirer.prompt([
      {
        name: 'plugins',
        type: 'checkbox',
        message: 'Choose plugins:',
        choices: options.map(({ displayName }) => displayName)
      }
    ]);
    ops = opgs || [];
  }
  const opSet = new Set(ops);
  const ready = types.filter(
    ({ isOption, displayName }) => !isOption || opSet.has(displayName!)
  );
  const requireSet = new Set<string>(
    ready.flatMap(({ requires }) => (requires || []) as string[])
  );
  const requireNames = [...requireSet];
  const requiring = requireNames.map(re => requires.require(re));
  const versions = await Promise.all(requiring);
  const requireVersions: Array<[string, string]> = versions
    .map((version, i) => {
      if (version == null) {
        return null;
      }
      return [requireNames[i], version];
    })
    .filter((d): d is [string, string] => d != null);
  const requireMap = new Map(requireVersions);
  const renders = ready
    .map(({ renders }) => renders[type])
    .filter((r): r is PluginRender => !!r);
  const defaultCaller = () => Promise.resolve(true);
  const pluginCaller = renders.reduce(
    (r: () => Promise<boolean>, c: PluginRender, i: number) => {
      const { requires } = ready[i];
      return function call() {
        return r().then(d => {
          if (!d) {
            return d;
          }
          return c(requires ? requires.map(r => requireMap.get(r)!) : []);
        });
      };
    },
    defaultCaller as () => Promise<boolean>
  );
  return pluginCaller();
}

export { loadPlugins };

export default {
  runPlugin
};
