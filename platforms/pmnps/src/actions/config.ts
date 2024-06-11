import { inquirer, path } from '@/libs';
import { hold } from '@/state';
import { CONF_NAME, DEFAULT_REGISTRY } from '@/constants';
import { packageJson } from '@/resource';
import { equal } from '@/libs/polyfill';
import { task } from './task';
import type { ActionMessage } from '@/actions/task/type';
import type { Config, ConfigDetail, PackageJson } from '@/types';

const configRange: Array<[string, keyof ConfigDetail]> = [
  ['allow publish to npm', 'private'],
  ['use monorepo', 'projectType'],
  ['use git', 'useGit'],
  ['use performance first', 'usePerformanceFirst'],
  ['use refresh after install', 'useRefreshAfterInstall']
];

function decodeConfig(config: Config | undefined) {
  const allCheckedConfig = {
    projectType: 'monorepo',
    private: false,
    useGit: true,
    usePerformanceFirst: true,
    useRefreshAfterInstall: true
  };
  const conf =
    config ??
    ({
      name: '',
      projectType: 'monorepo',
      private: true,
      useGit: false,
      usePerformanceFirst: false,
      useRefreshAfterInstall: false
    } as Config);
  return configRange
    .map(([desc, value]) => {
      return conf[value] === allCheckedConfig[value] ? desc : null;
    })
    .filter((d): d is string => !!d);
}

function encodeConfig(detail: string[]): ConfigDetail {
  const allCheckedConfig = {
    projectType: 'monorepo',
    private: false,
    useGit: true,
    usePerformanceFirst: true,
    useRefreshAfterInstall: true
  };
  const allUncheckedConfig = {
    projectType: 'classify',
    private: true,
    useGit: false,
    usePerformanceFirst: false,
    useRefreshAfterInstall: false
  };
  const set = new Set(detail);
  const e = configRange.map(([desc, key]) => {
    if (!set.has(desc)) {
      return [key, allUncheckedConfig[key]] as [string, string | boolean];
    }
    const value = allCheckedConfig[key];
    return [key, value] as [string, string | boolean];
  });
  return Object.fromEntries(e) as unknown as ConfigDetail;
}

export async function configAction(): Promise<ActionMessage> {
  const { config, project } = hold.instance().getState();
  let name = config?.name;
  const { name: firstSetName, detail } = await inquirer.prompt(
    [
      config?.name
        ? null
        : {
            name: 'name',
            type: 'input',
            message: 'Please enter the project name:',
            default: config?.name || project?.name || 'project'
          },
      {
        name: 'detail',
        type: 'checkbox',
        message: 'Config project:',
        choices: [
          new inquirer.Separator('-- choosing --'),
          ...configRange.map(([desc]) => desc),
          new inquirer.Separator('-- setting --'),
          'set workspace name',
          'set customized npm registry',
          'set project detail'
        ],
        default: decodeConfig(config)
      }
    ].filter(d => d != null)
  );
  name = firstSetName;
  if (detail.includes('set workspace name')) {
    const { name: workspaceName } = await inquirer.prompt([
      {
        name: 'name',
        type: 'input',
        message: 'Please enter the workspace name:',
        default: name ?? 'project'
      }
    ]);
    name = workspaceName;
  }
  let registry = config?.registry?.trim() || DEFAULT_REGISTRY;
  if (detail.includes('set customized npm registry')) {
    const { registry: reg } = await inquirer.prompt([
      {
        name: 'registry',
        type: 'input',
        message: 'Please enter the customized npm registry:',
        default: registry
      }
    ]);
    registry = reg ?? '';
  }
  const configSetting = { registry: registry.trim() || DEFAULT_REGISTRY };
  const projectDetail = {};
  if (detail.includes('set project detail')) {
    const detailSetting = await inquirer.prompt([
      {
        name: 'author',
        type: 'input',
        message: 'Please enter the author:',
        default: 'Author'
      },
      {
        name: 'version',
        type: 'input',
        message: 'Please enter the project version:',
        default: '0.0.0'
      },
      {
        name: 'description',
        type: 'input',
        message: 'Please enter the project description:',
        default: 'This is a project.'
      }
    ]);
    Object.assign(projectDetail, detailSetting);
  }
  const configDetail = encodeConfig(detail);
  const { config: nextConfig } = hold.instance().setState(s => {
    const { config: cf } = s;
    return {
      ...s,
      config: {
        ...cf,
        name: name == null ? cf?.name ?? 'project' : name,
        ...configDetail,
        ...configSetting
      }
    };
  });
  if (!nextConfig) {
    return {
      content: 'Config is failed for some system bug...',
      type: 'failed'
    };
  }
  const cwd = path.cwd();
  if (nextConfig.registry !== config?.registry) {
    task.write(cwd, '.npmrc', `registry=${nextConfig.registry}`);
  }
  if (!nextConfig.usePerformanceFirst || !equal(nextConfig, config)) {
    task.write(cwd, CONF_NAME, JSON.stringify(nextConfig));
  }
  task.writePackage({
    paths: null,
    packageJson: (json: PackageJson | null) => {
      const sourceJson: PackageJson = (json || {}) as PackageJson;
      const workspaces =
        nextConfig.projectType === 'monorepo'
          ? [...new Set(['packages/*', ...(sourceJson.workspaces ?? [])])]
          : undefined;
      const result = packageJson(nextConfig.name, 'workspace', {
        ...sourceJson,
        ...projectDetail,
        workspaces
      });
      if (equal(result, json)) {
        return null;
      }
      return result;
    },
    type: 'workspace'
  });
  return { content: 'Config success...', type: 'success' };
}
