import process from 'process';
import { format as formatPackageJson } from 'prettier-package-json';
import { message, path } from '@/libs';
import { hold } from '@/state';
import { equal, omitBy, orderBy, partition } from '@/libs/polyfill';
import { CONF_NAME, SystemFormatter } from '@/constants';
import { projectSupport } from '@/support';
import { SystemCommands } from '@/cmds';
import { remove } from '@/actions/task/remove';
import { executeSystemOrders } from './exec';
import { refreshProject } from './refresh';
import { write } from './write';
import type {
  PackageJson,
  Package,
  PackageType,
  Scope,
  Project,
  Config,
  LockResolver
} from '@pmnps/tools';
import type {
  ActionMessage,
  CommandSerial,
  ExecuteTask,
  Execution,
  PackageTask,
  Task
} from '@/actions/task/type';
import type { Command } from 'commander';

function getCachePath() {
  return path.join(path.cwd(), 'node_modules', '.cache', 'pmnps');
}

function writeDirTask(
  p: string | Array<string>,
  config?: { relative?: boolean; command?: CommandSerial[] }
) {
  const { command } = config ?? {};
  const pathname = typeof p === 'string' ? p : path.join(path.cwd(), ...p);
  const t: Task = {
    type: 'write',
    fileType: 'dir',
    file: pathname,
    path: pathname,
    content: pathname,
    option: omitBy(
      {
        command
      },
      value => value == null
    )
  };
  return t;
}

function writeFileTask(
  p: string,
  fileName: string,
  content: string | object | ((c: string | null) => string | null),
  config?: {
    skipIfExist?: true;
    command?: CommandSerial[];
    formatter?: (c: string) => Promise<string>;
  }
) {
  const { formatter, skipIfExist, command } = config ?? {};
  const t: Task = {
    type: 'write',
    fileType: 'file',
    file: fileName,
    path: p,
    content,
    option: omitBy(
      {
        formatter,
        skipIfExist,
        command
      },
      value => value == null
    )
  };
  return t;
}

function writeScopeToState(cwd: string, scopeName: string) {
  const { project = projectSupport.makeDefaultProject(cwd, 'monorepo') } = hold
    .instance()
    .getState();
  const scope: Scope = {
    name: scopeName,
    path: path.join(cwd, 'packages', scopeName),
    packages: []
  };
  project.project = project.project || {};
  project.project.scopes = project.project.scopes || [];
  const found = project.project.scopes.find(s => s.name === scopeName);
  if (found) {
    return;
  }
  project.project.scopes = orderBy(
    [...project.project.scopes, scope],
    ['name'],
    ['desc']
  );
}

function writePackageToState(cwd: string, packageData: Package) {
  function writeScopePackageToScope(proj: Project['project'], data: Package) {
    const names = data.name.split('/');
    if (names.length < 2 || !names[0].startsWith('@')) {
      return {};
    }
    const [scopeName] = names;
    const scopes = proj.scopes || [];
    const found = scopes.find(s => s.name === scopeName);
    if (found) {
      found.packages = orderBy(
        found.packages.map(p => (p.name === data.name ? data : p)),
        ['name'],
        ['desc']
      );
      return { scopes };
    }
    return {};
  }
  function writeNewScopePackageToScope(
    proj: Project['project'],
    data: Package
  ) {
    const names = data.name.split('/');
    if (names.length < 2 || !names[0].startsWith('@')) {
      return {};
    }
    const [scopeName] = names;
    const scopes = proj.scopes || [];
    const found = scopes.find(s => s.name === scopeName);
    if (found) {
      found.packages = orderBy([...found.packages, data], ['name'], ['desc']);
      return { scopes };
    }
    const newScope: Scope = {
      name: scopeName,
      path: path.join(cwd, 'packages', scopeName),
      packages: [data]
    };
    return { scopes: orderBy([...scopes, newScope], ['name'], ['desc']) };
  }
  const { path: pathname, type: packageType } = packageData;
  const { project = projectSupport.makeDefaultProject(cwd, 'monorepo') } = hold
    .instance()
    .getState();
  project.project = { ...project.project };
  project.packageMap[pathname] = packageData;
  if (packageType === 'workspace') {
    project.project.workspace = packageData;
  } else if (packageType === 'customized') {
    project.project.customized = project.project.customized || [];
    const p = project.project.customized.find(p => p.path === pathname);
    if (p == null) {
      project.project.customized = orderBy(
        [...project.project.customized, packageData],
        ['name'],
        ['desc']
      );
      Object.assign(project.packageMap, { [packageData.path]: packageData });
    }
  } else if (packageType === 'package') {
    project.project.packages = project.project.packages || [];
    const p = project.project.packages.find(p => p.path === pathname);
    if (p == null) {
      project.project.packages = orderBy(
        [...project.project.packages, packageData],
        ['name'],
        ['desc']
      );
      const toProject = writeNewScopePackageToScope(
        project.project,
        packageData
      );
      Object.assign(project.packageMap, { [packageData.path]: packageData });
      Object.assign(project.project, toProject);
    } else {
      Object.assign(p, packageData);
      Object.assign(project.packageMap, { [p.path]: p });
      const nextScopeContainer = writeScopePackageToScope(
        project.project,
        packageData
      );
      Object.assign(project.project, nextScopeContainer);
    }
  } else {
    project.project.platforms = project.project.platforms || [];
    const p = project.project.platforms.find(p => p.path === pathname);
    if (p == null) {
      project.project.platforms = orderBy(
        [...project.project.platforms, packageData],
        ['name'],
        ['desc']
      );
      Object.assign(project.packageMap, { [packageData.path]: packageData });
    } else {
      Object.assign(p, packageData);
      Object.assign(project.packageMap, { [p.path]: p });
    }
  }
  hold.instance().setState({ project: project as Project });
}

function omitNullOfPackageJson(p: PackageJson | null | undefined): typeof p {
  if (p == null) {
    return p;
  }
  return omitBy(p, v => v == null) as PackageJson;
}

export const task = {
  write(
    p: string,
    fileName: string,
    content: string | object | ((c: string | null) => string | null) | null,
    config?: {
      skipIfExist?: true;
      command?: CommandSerial[];
      formatter?: 'json' | ((c: string) => Promise<string>);
    }
  ) {
    function computeFormatter() {
      const configFormatter = config?.formatter;
      if (configFormatter) {
        return configFormatter === 'json'
          ? SystemFormatter.json
          : configFormatter;
      }
      if (fileName === 'package.json') {
        return SystemFormatter.packageJson;
      }
      if (fileName === 'package-lock.json') {
        return SystemFormatter.packageLockJson;
      }
      if (
        fileName.endsWith('.json') ||
        (content != null &&
          typeof content !== 'string' &&
          typeof content !== 'function')
      ) {
        return SystemFormatter.json;
      }
      return configFormatter;
    }
    const formatter = computeFormatter();
    if (content == null) {
      return null;
    }
    const t = writeFileTask(p, fileName, content, { ...config, formatter });
    hold.instance().pushTask(t);
    return t;
  },
  writeConfig(config: Config | ((c: Config) => Config)) {
    const currentConfig = hold.instance().getState().config;
    if (!currentConfig) {
      return task.write(path.cwd(), CONF_NAME, config);
    }
    const cfg = typeof config === 'function' ? config(currentConfig) : config;
    hold.instance().setState({ config: cfg });
    return task.write(path.cwd(), CONF_NAME, cfg);
  },
  writeCommandCache(
    command: string,
    data:
      | Record<string, any>
      | ((d: Record<string, any> | undefined) => Record<string, any>)
  ) {
    const t = writeFileTask(
      getCachePath(),
      'commands.json',
      text => {
        const obj =
          text == null
            ? {}
            : (function parseContent() {
                try {
                  return JSON.parse(text);
                } catch (e) {
                  return {};
                }
              })();
        const nextObj =
          typeof data === 'function'
            ? { ...obj, [command]: data(obj[command]) }
            : { ...obj, [command]: { ...obj[command], ...data } };
        return JSON.stringify(nextObj);
      },
      { formatter: SystemFormatter.json }
    );
    hold.instance().pushTask(t);
    return t;
  },
  writeDir(
    p: string | Array<string>,
    config?: {
      relative?: boolean;
      source?: string;
      command?: CommandSerial[];
      onFinish?: () => Promise<any>;
    }
  ) {
    const { command, source, onFinish } = config ?? {};
    const pathname = typeof p === 'string' ? p : path.join(path.cwd(), ...p);
    const t: Task = {
      type: 'write',
      fileType: 'dir',
      file: pathname,
      path: pathname,
      content: pathname,
      dirSource: source,
      option: omitBy(
        {
          command,
          onFinish
        },
        value => value == null
      )
    };
    hold.instance().pushTask(t);
    return t;
  },
  writeScope(scopeName: string) {
    const cwd = path.cwd();
    const t = writeDirTask(path.join(cwd, 'packages', scopeName));
    hold.instance().pushTask(t);
    writeScopeToState(cwd, scopeName);
    return t;
  },
  writePackage(pack: {
    paths: string[] | null;
    packageJson:
      | PackageJson
      | null
      | ((json: PackageJson | null) => PackageJson | null);
    type: PackageType;
  }) {
    const cwd = path.cwd();
    const { project = projectSupport.makeDefaultProject(cwd, 'monorepo') } =
      hold.instance().getState();
    const { paths, packageJson, type: packageType } = pack;
    const pathname = paths == null ? cwd : path.join(cwd, ...paths);
    const targetPackage = project.packageMap[pathname];
    const pjson = (function computeJson() {
      return typeof packageJson === 'function'
        ? targetPackage?.packageJson
          ? omitNullOfPackageJson(packageJson(targetPackage?.packageJson))
          : (content: string | null): string | null => {
              let r = null;
              if (content == null) {
                r = omitNullOfPackageJson(packageJson(null));
              } else {
                try {
                  const c = JSON.parse(content) as PackageJson;
                  r = omitNullOfPackageJson(packageJson(c));
                } catch (e) {
                  r = omitNullOfPackageJson(packageJson(null));
                }
              }
              if (r != null) {
                const packageData: Package = {
                  path: pathname,
                  paths,
                  category: 'packages',
                  packageJsonFileName: 'package.json',
                  packageJson: r,
                  name: r.name ?? '',
                  type: packageType
                };
                writePackageToState(cwd, packageData);
              }
              return r == null ? (r ?? null) : formatPackageJson(r);
            }
        : omitNullOfPackageJson(packageJson);
    })();
    if (
      pjson == null ||
      (typeof pjson !== 'function' &&
        targetPackage?.packageJson &&
        formatPackageJson(pjson) ===
          formatPackageJson(targetPackage?.packageJson))
    ) {
      return null;
    }
    const t = writeFileTask(
      pathname,
      'package.json',
      typeof pjson === 'function' ? pjson : formatPackageJson(pjson),
      {
        formatter: SystemFormatter.packageJson
      }
    );
    const p: PackageTask = { ...t, packageType, paths };
    hold.instance().pushTask(p);
    if (typeof pjson !== 'function') {
      const packageData: Package = {
        path: pathname,
        paths,
        category: 'packages',
        packageJsonFileName: 'package.json',
        packageJson: pjson,
        name: pjson.name ?? '',
        type: packageType
      };
      writePackageToState(cwd, packageData);
    }
    return p;
  },
  writePackageToState,
  remove(pathname: string, opt?: { fileType?: 'file' | 'dir' }) {
    const { fileType } = opt ?? {};
    const t: Task = {
      type: 'remove',
      path: pathname,
      cwd: path.cwd(),
      fileType
    };
    hold.instance().pushTask(t);
    return t;
  },
  execute(command: CommandSerial, cwd: string, description?: string) {
    function ifInstallLike() {
      const [first, second] = command;
      return first === 'symlink' || second === 'install' || second === 'ci';
    }
    const isInstallLike = ifInstallLike();
    const isCoreChanged = hold.instance().isCoreChanged();
    const t: Task = {
      type: 'exec',
      command,
      cwd,
      description
    };
    if (isCoreChanged && isInstallLike) {
      message.warn(
        'The pkg manage core is changed, please remove node_modules folders manually.'
      );
      return t;
    }
    hold.instance().pushTask(t);
    return t;
  }
};

function ifThereAreOnlyWriteCacheTasks(tasks: Task[]) {
  const pathname = path.join(path.cwd(), 'node_modules', '.cache', 'pmnps');
  return tasks.every(t => t.type === 'write' && t.path === pathname);
}

export function refreshCache() {
  const { project, cacheProject } = hold.instance().getState();
  if (project != null && !equal(project, cacheProject)) {
    const projectSerial = projectSupport.serial(project);
    task.write(
      path.join(path.cwd(), 'node_modules', '.cache', 'pmnps'),
      'project.json',
      projectSerial
    );
    const nextCache = projectSupport.parse(projectSerial);
    hold.instance().setState({ cacheProject: nextCache });
    return true;
  }
  return false;
}

async function executeTasks(
  requireRefresh: boolean | LockResolver,
  level?: number
) {
  const { config } = hold.instance().getState();
  const useGit = config?.useGit;
  const tasks = hold.instance().consumeTasks();
  if (tasks.length) {
    if (!level) {
      message.info('process executions...');
    }
    const [writes, others] = partition(tasks, t => t.type === 'write');
    const [removes, executes] = partition(others, t => t.type === 'remove');
    await remove(...removes);
    const npxOrders = await write(...writes);
    const orders = npxOrders
      .flat()
      .concat((executes as ExecuteTask[]).map(d => d));
    await executeSystemOrders(
      [
        ...orders,
        useGit && writes.length && !ifThereAreOnlyWriteCacheTasks(writes)
          ? { command: [...SystemCommands.gitAdd(), path.cwd()] }
          : null
      ].filter((d): d is Execution => !!d)
    );
    if (requireRefresh) {
      const result = await refreshProject();
      if (result.type === 'failed') {
        return result;
      }
      await executeTasks(false, (level || 0) + 1);
      return;
    }
  }
  refreshCache();
  const restTasks = hold.instance().getTasks();
  if (restTasks.length) {
    await executeTasks(requireRefresh, (level || 0) + 1);
  }
}

export async function executeAction(
  actionMessage: ActionMessage | null,
  requireRefresh?: boolean
) {
  let error = undefined;
  if (actionMessage?.type !== 'failed') {
    error = await executeTasks(
      requireRefresh || (actionMessage?.requireRefresh ?? false)
    );
  }
  const result = error ?? actionMessage;
  const childActionMessages = result?.children;
  if (childActionMessages && childActionMessages.length) {
    childActionMessages.forEach(a => {
      message.result({ ...a, content: `[plugin]: ${a.content}` });
    });
  }
  message.result(result);
  process.exit(0);
}

export function useCommand(
  com: Command,
  action: (...args: any[]) => Promise<ActionMessage | null>,
  requireRefresh?: boolean
) {
  return com.action(async (...args: any[]) => {
    const actionMessage = await action(...args);
    await executeAction(actionMessage, requireRefresh);
  });
}
