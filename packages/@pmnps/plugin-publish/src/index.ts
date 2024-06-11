import {
  createPluginCommand,
  execution,
  inquirer,
  message
} from '@pmnps/tools';
import type { ExecaSyncReturnValue } from 'execa';
import type { Plugin, Package } from '@pmnps/tools';

interface Query {
  registry?: string;
}

interface Option {
  force?: boolean;
  otp?: string;
  batch?: boolean;
}

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

async function fetchVersion(pack: Package): Promise<Package | null> {
  const { name, version, private: pri } = pack.packageJson;
  if (pri || !version || !name) {
    return null;
  }
  try {
    const { stdout, stderr } = await execution.exec('npm', [
      'view',
      name,
      'version'
    ]);
    if (stderr) {
      return pack;
    }
    const remoteVersion = stdout.trim();
    const isNotGreater = versionCompare(remoteVersion, version);
    if (!isNotGreater) {
      return pack;
    }
    return null;
  } catch (e: any) {
    if (!e || !e.toString().includes('404')) {
      return null;
    }
    return pack;
  }
}

function fetchNpmVersions(packs: Package[]) {
  const fetchingVersions = packs
    .filter(
      p =>
        !p.packageJson.private &&
        p.packageJson.version &&
        p.packageJson.name &&
        p.name === p.packageJson.name
    )
    .map(p => {
      return fetchVersion(p);
    });
  return Promise.all(fetchingVersions);
}

function logBuffer(buffer: ExecaSyncReturnValue | undefined) {
  if (!buffer) {
    return;
  }
  const { stdout, stderr } = buffer;
  if (stderr) {
    console.log(stderr);
  } else {
    console.log(stdout);
  }
}

const officialReg = 'https://registry.npmjs.org';

function levelPackages(packs: Package[]): Package[][] {
  const map = new Map(packs.map(p => [p.name, p] as [string, Package]));
  const top = packs.filter(p => {
    const { dependencies, devDependencies } = p.packageJson;
    const deps = { ...dependencies, ...devDependencies };
    const keys = Object.keys(deps);
    return keys.every(k => !map.has(k));
  });
  const topSet = new Set(top.map(p => p.name));
  const rest = packs.filter(p => !topSet.has(p.name));
  const result = [top];
  if (!rest.length) {
    return result;
  }
  const lower = levelPackages(rest);
  return result.concat(lower);
}

async function publishOneByOne(
  registry: string | null | undefined,
  packs: Package[],
  otp?: string
) {
  const [current, ...rest] = packs;
  if (current == null) {
    return;
  }
  const { path: pathname, packageJson, type } = current;
  const { name = '' } = packageJson;
  message.log(`==================== ${type} ${name} ====================`);
  const isScopePackage = name.startsWith('@');
  const scopeParams = isScopePackage ? ['--access=public'] : [];
  const otpParams = otp ? ['--otp', otp] : [];
  await execution.exec(
    'npm',
    [
      'publish',
      '--registry',
      registry || officialReg,
      ...scopeParams,
      ...otpParams
    ],
    {
      cwd: pathname,
      stdio: 'inherit'
    }
  );
  if (!rest.length) {
    return;
  }
  await publishOneByOne(registry, rest, otp);
}

const USE_PUBLISH_OTP = 'use npm publish --otp';

const USE_BATCH_PUBLISH = 'use batch publish';

const publishPlugin: Plugin<Query> = function publishPlugin(query?: Query) {
  const slot = createPluginCommand('publish');
  return slot
    .require(async state => {
      const { private: isPrivate, projectType } = state.getConfig();
      if (isPrivate) {
        return null;
      }
      const { project } = state.getProject();
      const { packages = [], platforms = [], workspace } = project;
      if (workspace == null) {
        return null;
      }
      const publishRecommends = await fetchNpmVersions(
        projectType === 'monorepo' ? [...packages, ...platforms] : [workspace]
      );
      return publishRecommends.filter((p): p is Package => !!p);
    })
    .option('force', 'f', { description: 'Ignore version comparing' })
    .option('otp', 'o', {
      description: 'Use npm publish --otp',
      inputType: 'string'
    })
    .option('batch', 'b', { description: 'Batch publish packages' })
    .describe('Publish packages and platforms.')
    .action(async (state, option: Option | undefined) => {
      const { required, getConfig, getProject } = state;
      const { force, otp, batch } = option ?? {};
      const { private: pri, registry, projectType } = getConfig();
      const { project } = getProject();
      const { packages = [], platforms = [], workspace } = project;
      if (!workspace) {
        return {
          type: 'warning',
          content: 'No package is found for publish...'
        };
      }
      if (pri) {
        return {
          type: 'failed',
          content:
            'This is a private project, all packages in it can not be published...'
        };
      }
      let publishes: Package[] = [...packages, ...platforms, workspace].filter(
        p =>
          !p.packageJson.private && p.packageJson.name && p.packageJson.version
      );
      if (!force) {
        const publishRecommends: Package[] | null = await required;
        publishes = publishRecommends || [];
      }
      if (!publishes.length) {
        return {
          type: 'warning',
          content: 'No package is found for publish...'
        };
      }
      const packagePacks = publishes.filter(p => p.type === 'package');
      const platformPacks = publishes.filter(p => p.type === 'platform');
      const workspacePacks = publishes.filter(p => p.type === 'workspace');
      const packageNames = packagePacks.length
        ? [
            new inquirer.Separator('-- packages --'),
            ...packages.map(p => p.name)
          ]
        : [];
      const platformNames = platformPacks.length
        ? [
            new inquirer.Separator('-- platforms --'),
            ...platforms.map(p => p.name)
          ]
        : [];
      const workspaceNames =
        projectType === 'classify' && workspacePacks.length
          ? [
              new inquirer.Separator('-- workspaces --'),
              ...workspacePacks.map(p => p.name)
            ]
          : [];
      const settings = [
        otp == null ? USE_PUBLISH_OTP : null,
        batch ? null : USE_BATCH_PUBLISH
      ].filter((d): d is string => d != null);
      const settingNames = settings.length
        ? [new inquirer.Separator('-- setting --'), ...settings]
        : [];
      const { selected } = await inquirer.prompt([
        {
          name: 'selected',
          type: 'checkbox',
          choices: [
            ...packageNames,
            ...platformNames,
            ...workspaceNames,
            ...settingNames
          ],
          message: 'Choose package or platforms for publish.',
          default: publishes.map(p => p.name)
        }
      ]);
      const settingSet = new Set([USE_PUBLISH_OTP, USE_BATCH_PUBLISH]);
      const selectedPublishPacks = selected.filter(d => !settingSet.has(d));
      const reg = query?.registry || registry;
      const selectedSet = new Set(selectedPublishPacks as string[]);
      const selectedPacks = publishes.filter(p => selectedSet.has(p.name));
      const groups = levelPackages(selectedPacks);
      const sortedPacks = groups.flat();
      const batchPublish = batch || selected.some(d => d === USE_BATCH_PUBLISH);
      let publishOtp = otp;
      if (selected.some(d => d === USE_PUBLISH_OTP)) {
        const { otp: settedOtp } = await inquirer.prompt([
          {
            name: 'otp',
            type: 'input',
            message: 'Please enter the publish password.(--otp)'
          }
        ]);
        publishOtp = settedOtp;
      }
      if (batchPublish) {
        const processes = sortedPacks.map(p => {
          const { path: pathname, packageJson } = p;
          const { name = '' } = packageJson;
          const isScopePackage = name.startsWith('@');
          const scopeParams = isScopePackage ? ['--access=public'] : [];
          const otpParams = publishOtp ? ['--otp', publishOtp] : [];
          return execution.exec(
            'npm',
            [
              'publish',
              '--registry',
              reg || officialReg,
              ...scopeParams,
              ...otpParams
            ],
            {
              cwd: pathname,
              stdin: 'inherit'
            }
          );
        });
        const results = await Promise.all(processes);
        results.forEach((buffer, index) => {
          const { name, type } = sortedPacks[index];
          message.log(
            `==================== ${type} ${name} ====================`
          );
          logBuffer(buffer);
        });
        return {
          type: 'success',
          content: 'Publish success...'
        };
      }
      await publishOneByOne(reg, sortedPacks, publishOtp);
      return {
        type: 'success',
        content: 'Publish success...'
      };
    });
};

export default publishPlugin;
