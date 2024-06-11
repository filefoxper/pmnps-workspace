import { inquirer } from '@/libs';
import { hold } from '@/state';
import { keyBy, partition } from '@/libs/polyfill';
import { task } from '@/actions/task';
import type { ActionMessage } from '@/actions/task/type';

function getProject() {
  const { project } = hold.instance().getState();
  return project;
}

export async function startAction(options?: {
  all?: boolean;
  group?: string;
  name?: string;
}): Promise<ActionMessage> {
  const { all, name, group } = options ?? {};
  const groupName = typeof group === 'string' ? group.trim() : null;
  const projectWrap = getProject();
  const packageMap = projectWrap?.packageMap;
  if (packageMap == null) {
    return {
      type: 'warning',
      content: 'No runnable package or platform is found.'
    };
  }
  const entries = Object.entries(packageMap);
  const packages = entries
    .map(([p, v]) => ({ ...v, path: p }))
    .filter(pack => {
      return pack.packageJson.scripts?.start;
    });
  const names = packages.map(p => p.name);
  const argumentName = (name ?? '').trim();
  const argumentNames = argumentName
    ? new Set(
        argumentName
          .split(' ')
          .map(n => n.trim())
          .filter(n => n)
      )
    : null;
  const preSetNames = all
    ? names
    : argumentNames
      ? names.filter(n => argumentNames.has(n))
      : null;
  if (!packages.length || (preSetNames && !preSetNames.length)) {
    return {
      type: 'warning',
      content: 'No runnable package or platform is found.'
    };
  }
  let selected: string[] = preSetNames || [];
  const packageNameKeyMap = keyBy(packages, 'name');

  const { start = {} } = hold.instance().getState().commands ?? {};
  const { groups: gs = [] } = start;
  const groups: { name: string; selected: string[] }[] = gs;
  const groupNameMap = keyBy(groups, 'name');

  if (!preSetNames) {
    const [packs, others] = partition(
      packages,
      pack => pack.type === 'package'
    );
    const [platforms, workspaces] = partition(
      others,
      pack => pack.type === 'platform'
    );
    const groupNames =
      groupNameMap.size && groupName == null
        ? [new inquirer.Separator('-- groups --'), ...groupNameMap.keys()]
        : [];
    const packageNames = packs.length
      ? [new inquirer.Separator('-- packages --'), ...packs.map(p => p.name)]
      : [];
    const platformNames = platforms.length
      ? [
          new inquirer.Separator('-- platforms --'),
          ...platforms.map(p => p.name)
        ]
      : [];
    const workspaceNames = workspaces.length
      ? [
          new inquirer.Separator('-- workspaces --'),
          ...workspaces.map(p => p.name)
        ]
      : [];
    const { starts } = await inquirer.prompt([
      {
        name: 'starts',
        type: 'checkbox',
        message: 'Choose packages or platforms to start.',
        choices: [
          ...groupNames,
          ...packageNames,
          ...platformNames,
          ...workspaceNames
        ]
      }
    ]);
    const results = starts as string[];
    const [selectedGroups, selectedOthers] = partition(results, n =>
      groupNameMap.has(n)
    );
    const allGroupSelected = selectedGroups.flatMap(n => {
      const g = groupNameMap.get(n);
      if (g == null) {
        return [];
      }
      return g.selected;
    });
    selected = [...new Set([...allGroupSelected, ...selectedOthers])].filter(
      n => packageNameKeyMap.has(n)
    );
  }
  if (!selected.length) {
    if (groupName && groupNameMap.has(groupName)) {
      task.writeCommandCache('start', (data = {}) => {
        const groups = data.groups || [];
        return {
          ...data,
          groups: groups.filter((g: { name: string }) => g.name !== groupName)
        };
      });
    }
    return { type: 'warning', content: 'No packages or platforms is chosen.' };
  }
  if (groupName && packageNameKeyMap.get(groupName) == null) {
    task.writeCommandCache('start', (data = {}) => {
      const groups: { name: string; selected: string[] }[] = data.groups || [];
      const gsMap = keyBy(groups, 'name');
      const newGsMap = new Map([
        ...gsMap,
        [groupName, { name: groupName, selected }] as const
      ]);
      return { ...data, groups: [...newGsMap.values()] };
    });
  }
  if (groups.length != groupNameMap.size) {
    task.writeCommandCache('start', (data = {}) => {
      const groups = data.groups || [];
      return {
        ...data,
        groups: groups.filter((g: { name: string }) => groupNameMap.has(g.name))
      };
    });
  }
  selected.forEach(n => {
    const p = packageNameKeyMap.get(n);
    if (p == null) {
      return undefined;
    }
    const { path } = p;
    task.execute(['npm', 'start'], path);
  });
  return {
    type: 'success',
    content: 'The selected packages or platforms are started.'
  };
}

export async function runAction(
  cmd: string | null,
  options?: { name?: string; group?: string; all?: boolean }
): Promise<ActionMessage> {
  const { all, name, group } = options ?? {};
  const groupName = typeof group === 'string' ? group.trim() : null;
  const command = (cmd ?? '').trim();
  if (!command) {
    return { type: 'warning', content: 'No command for execution.' };
  }
  const projectWrap = getProject();
  const packageMap = projectWrap?.packageMap;
  if (packageMap == null) {
    return {
      type: 'warning',
      content: 'No runnable package or platform is found.'
    };
  }
  const entries = Object.entries(packageMap);
  const packages = entries
    .map(([p, v]) => ({ ...v, path: p }))
    .filter(pack => {
      return pack.packageJson.scripts?.[command];
    });
  const names = packages.map(p => p.name);
  const argumentName = (name ?? '').trim();
  const argumentNames = argumentName
    ? new Set(
        argumentName
          .split(' ')
          .map(n => n.trim())
          .filter(n => n)
      )
    : null;
  const preSetNames = all
    ? names
    : argumentNames
      ? names.filter(n => argumentNames.has(n))
      : null;
  if (!packages.length || (preSetNames && !preSetNames.length)) {
    return {
      type: 'warning',
      content: 'No runnable package or platform is found.'
    };
  }
  let selected: string[] = preSetNames || [];
  const packageNameKeyMap = keyBy(packages, 'name');

  const { run = {} } = hold.instance().getState().commands ?? {};
  const { groups: gs = [] } = run;
  const groups: { name: string; command: string; selected: string[] }[] = gs;
  const groupNameMap = keyBy(groups, 'name');

  if (!preSetNames) {
    const [packs, others] = partition(
      packages,
      pack => pack.type === 'package'
    );
    const [platforms, workspaces] = partition(
      others,
      pack => pack.type === 'platform'
    );
    const groupNames =
      groupNameMap.size && groupName == null
        ? [new inquirer.Separator('-- groups --'), ...groupNameMap.keys()]
        : [];
    const packageNames = packs.length
      ? [new inquirer.Separator('-- packages --'), ...packs.map(p => p.name)]
      : [];
    const platformNames = platforms.length
      ? [
          new inquirer.Separator('-- platforms --'),
          ...platforms.map(p => p.name)
        ]
      : [];
    const workspaceNames = workspaces.length
      ? [
          new inquirer.Separator('-- workspaces --'),
          ...workspaces.map(p => p.name)
        ]
      : [];
    const { runner } = await inquirer.prompt([
      {
        name: 'runner',
        type: 'checkbox',
        message: 'Choose packages or platforms to run.',
        choices: [
          ...groupNames,
          ...packageNames,
          ...platformNames,
          ...workspaceNames
        ]
      }
    ]);
    const results = runner as string[];
    const [selectedGroups, selectedOthers] = partition(results, n =>
      groupNameMap.has(n)
    );
    const allGroupSelected = selectedGroups.flatMap(n => {
      const g = groupNameMap.get(n);
      if (g == null) {
        return [];
      }
      return g.selected;
    });
    selected = [...new Set([...allGroupSelected, ...selectedOthers])].filter(
      n => packageNameKeyMap.has(n)
    );
  }
  if (!selected.length) {
    if (groupName && groupNameMap.has(groupName)) {
      task.writeCommandCache('run', (data = {}) => {
        const groups = data.groups || [];
        return {
          ...data,
          groups: groups.filter(
            (g: { name: string; command: string }) =>
              g.name !== groupName || g.command !== command
          )
        };
      });
    }
    return { type: 'warning', content: 'No packages or platforms is chosen.' };
  }
  if (groupName && packageNameKeyMap.get(groupName) == null) {
    task.writeCommandCache('run', (data = {}) => {
      const groups: { name: string; command: string; selected: string[] }[] =
        data.groups || [];
      const gsMap = keyBy(groups, g => g.command + ':' + g.name);
      const newGsMap = new Map([
        ...gsMap,
        [
          command + ':' + groupName,
          { name: groupName, command, selected }
        ] as const
      ]);
      return {
        ...data,
        groups: [...newGsMap.values()]
      };
    });
  }
  selected.forEach(n => {
    const p = packageNameKeyMap.get(n);
    if (p == null) {
      return undefined;
    }
    const { path } = p;
    task.execute(['npm', 'run', command], path);
  });
  return {
    type: 'success',
    content: 'Scripts are executed success.'
  };
}
