import process from 'process';
import { format as formatPackageJson } from 'prettier-package-json';
import { message, path } from '@/libs';
import { hold } from '@/state';
import { equal, omitBy, orderBy, partition } from '@/libs/polyfill';
import { write } from '@/actions/task/write';
import { executeSystemOrders } from '@/actions/task/exec';
import { SystemCommands, SystemFormatter } from '@/constants';
import { projectSupport } from '@/support';
import type {
  Package,
  PackageJson,
  PackageType,
  Project,
  Scope
} from '@/types';
import type {
  ActionMessage,
  CommandSerial,
  ExecuteTask,
  Execution,
  PackageTask,
  Task
} from '@/actions/task/type';
import type { Command } from 'commander';

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
      Object.assign(project.project, toProject);
    } else {
      Object.assign(p, packageData);
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
    } else {
      Object.assign(p, packageData);
    }
  }
  hold.instance().setState({ project: project as Project });
}

export const task = {
  write(
    p: string,
    fileName: string,
    content: string | object | ((c: string | null) => string | null) | null,
    config?: {
      skipIfExist?: true;
      command?: CommandSerial[];
      formatter?: (c: string) => Promise<string>;
    }
  ) {
    const formatter =
      !config?.formatter && fileName.endsWith('.json')
        ? SystemFormatter.json
        : config?.formatter;
    if (content == null) {
      return null;
    }
    const t = writeFileTask(p, fileName, content, { ...config, formatter });
    hold.instance().pushTask(t);
    return t;
  },
  writeDir(
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
        ? packageJson(targetPackage?.packageJson)
        : packageJson;
    })();
    if (pjson == null) {
      return null;
    }
    const t = writeFileTask(
      pathname,
      'package.json',
      formatPackageJson(pjson),
      {
        formatter: SystemFormatter.packageJson
      }
    );
    const p: PackageTask = { ...t, packageType, paths };
    const packageData: Package = {
      path: pathname,
      paths,
      packageJsonFileName: 'package.json',
      packageJson: pjson,
      name: pjson.name ?? '',
      type: packageType
    };
    hold.instance().pushTask(p);
    writePackageToState(cwd, packageData);
    return p;
  },
  execute(command: CommandSerial, cwd: string, description?: string) {
    const t: Task = {
      type: 'exec',
      command,
      cwd,
      description
    };
    hold.instance().pushTask(t);
    return t;
  }
};

async function executeTasks(actionMessage: ActionMessage | null) {
  const { config, project, cacheProject } = hold.instance().getState();
  const useGit = config?.useGit;
  if (project != null && !equal(project, cacheProject)) {
    task.write(
      path.join(path.cwd(), 'node_modules', '.cache', 'pmnps'),
      'project.json',
      projectSupport.serial(project)
    );
  }
  const tasks = hold.instance().consumeTasks();
  if (!tasks.length) {
    message.result(actionMessage);
    process.exit(0);
    return;
  }
  message.info('process executions...');
  const [writes, executes] = partition(tasks, t => t.type === 'write');
  const npxOrders = await write(...writes);
  const orders = npxOrders
    .flat()
    .concat((executes as ExecuteTask[]).map(d => d));
  await executeSystemOrders(
    [
      ...orders,
      useGit && writes.length
        ? { command: [...SystemCommands.gitAdd, path.cwd()] }
        : null
    ].filter((d): d is Execution => !!d)
  );
  message.result(actionMessage);
  process.exit(0);
}

export function useCommand(
  com: Command,
  action: (...args: any[]) => Promise<ActionMessage | null>
) {
  return com.action(async (...args: any[]) => {
    const actionMessage = await action(...args);
    await executeTasks(actionMessage);
  });
}
