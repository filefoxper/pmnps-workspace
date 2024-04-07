import { inquirer } from '@/libs';
import { task } from '@/actions/task';
import { hold } from '@/state';
import { packageJson } from '@/resource';
import { omitBy, pick } from '@/libs/polyfill';
import { refreshAction } from '@/actions/refresh';
import type { PackageJson, Scope } from '@/types';
import type { ActionMessage } from '@/actions/task/type';

const creations: Array<string | undefined | null> = [
  'scope',
  'package',
  'platform',
  'template'
];

async function processName(
  creation: 'scope' | 'package' | 'platform' | 'template',
  targetName: string | undefined | null
): Promise<ActionMessage> {
  let target = targetName;
  if (target == null) {
    const { name } = await inquirer.prompt([
      {
        name: 'name',
        message: `Please enter the ${creation} name:`,
        type: 'input'
      }
    ]);
    target = name;
  }
  if (!target || !target.trim()) {
    return {
      content: `Name is required for creating a ${creation}...`,
      type: 'warning'
    };
  }
  return {
    content: target.trim(),
    type: 'success'
  };
}

async function createScope(target: string | undefined): Promise<ActionMessage> {
  const res = await processName('scope', target);
  if (res.type !== 'success') {
    return res;
  }
  const { content: name } = res;
  if (name.includes('/')) {
    return {
      content: 'A scope name can not contain character "/".',
      type: 'failed'
    };
  }
  const scopeName = name.startsWith('@') ? name : `@${name}`;
  task.writeScope(scopeName);
  return { content: `Create scope "${scopeName}" success...`, type: 'success' };
}

async function createPackageOrTemplate(
  target: string | undefined,
  packageType: 'package' | 'template' = 'package'
): Promise<ActionMessage> {
  async function reselectScope(
    currentScopeName: string,
    similarScopes: Scope[],
    forceCreateScope?: boolean
  ): Promise<ActionMessage> {
    if (!similarScopes.length || forceCreateScope) {
      return { content: currentScopeName, type: 'success' };
    }
    const { ok } = await inquirer.prompt([
      {
        name: 'ok',
        type: 'confirm',
        message: 'Do you want to select a similar scope?'
      }
    ]);
    if (!ok) {
      return reselectScope(currentScopeName, similarScopes, true);
    }
    const similarScopeNames = similarScopes.map(s => s.name);
    const { scopeName } = await inquirer.prompt([
      {
        name: 'scopeName',
        type: 'list',
        choices: similarScopeNames,
        message: 'Choose a scope for the new package',
        default: similarScopeNames[0]
      }
    ]);
    return { content: scopeName, type: 'success' };
  }
  const res = await processName(packageType, target);
  if (res.type !== 'success') {
    return res;
  }
  const { content: packageName } = res;
  const names = packageName.split('/');
  const scopeName = (function computeScopeName() {
    if (names.length > 1) {
      const [s] = names;
      return s.startsWith('@') ? s : `@${s}`;
    }
    return undefined;
  })();
  const project = hold.instance().getState().project?.project ?? {};
  const rootPackageJson = project.workspace?.packageJson ?? {
    version: '0.0.0',
    author: undefined
  };
  const scopes = project.scopes ?? [];
  const similarScopes =
    scopeName && scopes.every(s => s.name !== scopeName)
      ? scopes.filter(s => s.name.startsWith(scopeName))
      : null;
  let sn = scopeName;
  if (similarScopes && sn) {
    const reslectResult = await reselectScope(sn, similarScopes);
    if (reslectResult.type === 'success') {
      sn = reslectResult.content;
    }
  }
  const parentPaths = ['packages', sn];
  const packagePath = (function computePackagePath() {
    if (names.length > 1) {
      const [, nameWithScope] = names;
      return [...parentPaths, nameWithScope].filter((d): d is string => !!d);
    }
    const [directName] = names;
    return [...parentPaths, directName].filter((d): d is string => !!d);
  })();
  const packageJsonName = (function computePackageName() {
    if (names.length > 1) {
      const [, nameWithScope] = names;
      return [sn, nameWithScope].filter((d): d is string => !!d).join('/');
    }
    const [directName] = names;
    return directName;
  })();
  const pj: PackageJson = packageJson(
    packageJsonName,
    'package',
    omitBy(pick(rootPackageJson, 'version', 'author'), v => v == null)
  );
  task.writePackage({ paths: packagePath, type: 'package', packageJson: pj });
  return {
    content: packageJsonName,
    type: 'success'
  };
}

async function createPackage(
  target: string | undefined
): Promise<ActionMessage> {
  const res = await createPackageOrTemplate(target);
  if (res.type !== 'success') {
    return res;
  }
  return {
    content: `Create package "${res.content}" success...`,
    type: 'success'
  };
}

async function createTemplate(
  target: string | undefined
): Promise<ActionMessage> {
  const res = await createPackageOrTemplate(target, 'template');
  if (res.type !== 'success') {
    return res;
  }
  return {
    content: `Create template "${res.content}" success...`,
    type: 'success'
  };
}

async function createPlatform(
  target: string | undefined
): Promise<ActionMessage> {
  const res = await processName('platform', target);
  if (res.type !== 'success') {
    return res;
  }
  const { content: name } = res;
  const platformName = name;
  return {
    content: `Create platform "${platformName}" success...`,
    type: 'success'
  };
}

export async function createActionResolve(
  argument?: string | null,
  options?: { name?: string }
): Promise<ActionMessage> {
  const { name: target } = options ?? {};
  let arg = argument;
  if (!creations.includes(arg)) {
    const { creation: c } = await inquirer.prompt([
      {
        name: 'creation',
        type: 'list',
        message: 'Please choose a creation type:',
        choices: creations,
        default: 'scope'
      }
    ]);
    arg = c;
  }
  const creation = arg ?? 'scope';
  if (creation === 'scope') {
    return createScope(target);
  } else if (creation === 'template') {
    return createTemplate(target);
  } else if (creation === 'platform') {
    return createPlatform(target);
  }
  return createPackage(target);
}

export async function createAction(
  argument?: string | null,
  options?: { name?: string }
): Promise<ActionMessage> {
  const result = await createActionResolve(argument, options);
  await refreshAction();
  return result;
}
