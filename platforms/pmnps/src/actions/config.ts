import { inquirer, path } from '@/libs';
import { hold } from '@/state';
import { CONF_NAME, DEFAULT_REGISTRY } from '@/constants';
import { packageJson } from '@/resource';
import { equal, omit, omitBy, pick } from '@/libs/polyfill';
import { task } from './task';
import type {
  PackageJson,
  ConfigDetail,
  Config,
  ConfigSetting
} from '@pmnps/tools';
import type { ActionMessage } from '@/actions/task/type';

const configRange: Array<[string, keyof ConfigDetail]> = [
  ['allow publish to npm', 'private'],
  ['use monorepo', 'projectType'],
  ['use git', 'useGit'],
  ['use command help', 'useCommandHelp'],
  ['use performance first', 'usePerformanceFirst']
];

function defaultConfig(): Config {
  return {
    name: '',
    core: 'npm',
    projectType: 'monorepo',
    private: true,
    useGit: false,
    useCommandHelp: false,
    usePerformanceFirst: false
  };
}

function decodeConfig(config: Config | undefined) {
  const allCheckedConfig = {
    projectType: 'monorepo',
    private: false,
    useGit: true,
    useCommandHelp: true,
    usePerformanceFirst: true
  };
  const conf =
    config ??
    ({
      name: '',
      projectType: 'monorepo',
      private: true,
      useGit: false,
      useCommandHelp: false,
      usePerformanceFirst: false
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
    useCommandHelp: true,
    usePerformanceFirst: true
  };
  const allUncheckedConfig = {
    projectType: 'classify',
    private: true,
    useGit: false,
    useCommandHelp: false,
    usePerformanceFirst: false
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

const installFeatures = new Map<string, keyof ConfigSetting>([
  ['auto refresh after install', 'refreshAfterInstall'],
  ['forbidden workspace package install', 'forbiddenWorkspacePackageInstall'],
  ['list package dependencies in workspace project', 'listPackageDependencies'],
  ['set install parameters', 'installParameters'],
  ['install with npm ci command first', 'npmCiFirst']
]);

export async function configAction(
  template?: string | null
): Promise<ActionMessage> {
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
          'set package manager',
          'set workspace name',
          'set customized npm registry',
          'set project detail'
        ],
        default: decodeConfig(config)
      }
    ].filter(d => d != null)
  );
  name = firstSetName;
  let core = config?.core || 'npm';
  let confirmSetInstallFeatures = false;
  let installParameters = config?.installParameters;
  const coreFeatures =
    config == null
      ? {}
      : pick(
          config,
          'forbiddenWorkspacePackageInstall',
          'refreshAfterInstall',
          'listPackageDependencies',
          'npmCiFirst'
        );
  if (detail.includes('set package manager')) {
    const { manager, confirmSetFeatures } = await inquirer.prompt([
      {
        name: 'manager',
        type: 'list',
        message: 'Please choose a package manager.',
        choices: ['npm', 'yarn', 'yarn2', 'pnpm'],
        default: core
      },
      {
        name: 'confirmSetFeatures',
        type: 'confirm',
        message: 'Do you want to set package manager features?',
        default: true
      }
    ]);
    core = manager;
    confirmSetInstallFeatures = confirmSetFeatures;
  }
  if (confirmSetInstallFeatures) {
    const keys = [...installFeatures.keys()];
    const revertInstallFeatures = new Map(
      [...installFeatures].map(([k, v]) => [v, k] as const)
    );
    const { features } = await inquirer.prompt([
      {
        name: 'features',
        type: 'checkbox',
        choices: core !== 'npm' ? keys.slice(0, 4) : keys,
        message: `Please choose the features you want to set for "${core}".`,
        default: Object.entries(coreFeatures)
          .filter(([k, v]) => !!v)
          .map(([k]) => revertInstallFeatures.get(k as keyof ConfigSetting))
          .filter((n): n is string => !!n)
      }
    ]);
    const featureSet = new Set(features);
    const featureSetting = Object.fromEntries(
      keys.map(f => {
        return [
          installFeatures.get(f) as keyof ConfigSetting,
          featureSet.has(f)
        ] as const;
      })
    ) as Record<keyof Partial<ConfigSetting>, boolean>;
    if (featureSetting.installParameters) {
      const { installParam } = await inquirer.prompt([
        {
          name: 'installParam',
          type: 'input',
          message: `Please enter the global install parameters for "${core}".`
        }
      ]);
      installParameters = installParam;
    }
    const fs = omit(featureSetting, 'installParameters') as Partial<any>;
    Object.assign(coreFeatures, fs);
  }
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
  const configSetting = {
    registry: registry.trim() || DEFAULT_REGISTRY,
    core: core.trim() as 'npm' | 'yarn' | 'yarn2' | undefined,
    installParameters,
    ...coreFeatures
  };
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
      config: omitBy(
        {
          ...cf,
          name: name == null ? (cf?.name ?? 'project') : name,
          ...configDetail,
          ...configSetting
        },
        value => value == null
      ) as Config
    };
  });
  if (!nextConfig) {
    return {
      content: 'Config is failed for some system bug...',
      type: 'failed'
    };
  }
  const cwd = path.cwd();
  if (!nextConfig.usePerformanceFirst || !equal(nextConfig, config)) {
    task.write(cwd, CONF_NAME, JSON.stringify(nextConfig));
  }
  if (nextConfig.registry && nextConfig.registry !== DEFAULT_REGISTRY) {
    task.write(cwd, '.npmrc', npmrc => {
      if (npmrc == null) {
        return `registry=${registry}`;
      }
      const contents = (npmrc || '').split('\n');
      const contentSet = new Set(
        [...contents, `registry=${registry}`]
          .filter(r => r.trim())
          .map(r => r.trim())
      );
      return [...contentSet].join('\n');
    });
  }
  if (config && nextConfig.core !== config.core) {
    hold.instance().setCoreChanged();
  }
  task.writePackage({
    paths: null,
    packageJson: (json: PackageJson | null) => {
      const sourceJson: PackageJson = (json ||
        (template
          ? {
              devDependencies: { [template]: 'latest' }
            }
          : {})) as PackageJson;
      const result = packageJson(nextConfig.name, 'workspace', {
        ...sourceJson,
        ...projectDetail
      });
      if (equal(result, json)) {
        return null;
      }
      return result;
    },
    type: 'workspace'
  });
  return {
    content: 'Config pmnps success...',
    type: 'success'
  };
}
