import { inquirer, path } from '@/libs';
import { task } from '@/actions/task';
import { hold } from '@/state';
import { packageJson } from '@/resource';
import { omitBy, pick } from '@/libs/polyfill';
import { templateSupport } from '@/support/template';
import type { PmnpsJson } from '@pmnps/tools';
import type { PackageJson, PackageType, Scope } from '@pmnps/tools';
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

function getRootPackageJson() {
  const project = hold.instance().getState().project?.project ?? {};
  return (
    project.workspace?.packageJson ?? {
      version: '0.0.0',
      author: undefined
    }
  );
}

async function createPackageOrTemplate(
  target: string | undefined,
  packageType: 'package' | 'template' = 'package'
): Promise<
  ActionMessage<
    | {
        paths: string[] | null;
        packageJson:
          | PackageJson
          | null
          | ((json: PackageJson | null) => PackageJson | null);
        type: PackageType;
      }
    | undefined
  >
> {
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
    return res as ActionMessage<undefined>;
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
  const rootPackageJson = getRootPackageJson();
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
  const packageJsonTemplate = omitBy(
    pick(rootPackageJson, 'version', 'author'),
    v => v == null
  );
  const pj: PackageJson = packageJson(
    packageJsonName,
    'package',
    packageJsonTemplate
  );
  return {
    content: packageJsonName,
    payload: { paths: packagePath, type: 'package', packageJson: pj },
    type: 'success'
  };
}

async function setPackageOptions(
  type: 'package' | 'platform'
): Promise<{ pmnps?: PmnpsJson }> {
  const { setting } = await inquirer.prompt([
    {
      name: 'setting',
      type: 'confirm',
      message: `Do you want to set options for this ${type}?`
    }
  ]);
  if (!setting) {
    return {};
  }
  const optionMap = new Map([[`use node_modules in this ${type}`, 'ownRoot']]);
  const { options } = await inquirer.prompt([
    {
      name: 'options',
      type: 'checkbox',
      message: `Choose options for this ${type}`,
      choices: [...optionMap.keys()]
    }
  ]);
  const pmnpsOptions: string[] = options;
  const pmnpsKeys = pmnpsOptions
    .map(n => optionMap.get(n))
    .filter((v): v is string => !!v);
  return {
    pmnps: Object.fromEntries(
      pmnpsKeys.map(k => [k, true] as const)
    ) as PmnpsJson
  };
}

async function createPackage(
  target: string | undefined
): Promise<ActionMessage> {
  const res = await createPackageOrTemplate(target);
  if (res.type !== 'success') {
    return res;
  }
  const { payload } = res;
  if (!payload) {
    return {
      content: `Create package "${res.content}" success...`,
      type: 'success'
    };
  }
  const pmnpsWrap = await setPackageOptions('package');
  const templates = hold
    .instance()
    .getTemplates()
    .filter(t => t.projectType === 'package');
  if (templates.length) {
    const { confirm } = await inquirer.prompt([
      {
        name: 'confirm',
        type: 'confirm',
        message: 'Do you want to create package with templates?'
      }
    ]);
    if (!confirm) {
      const pj = payload.packageJson as PackageJson;
      task.writePackage({
        ...payload,
        packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap })
      });
      return {
        content: `Create package "${res.content}" success...`,
        type: 'success'
      };
    }
    const templateMap = new Map(templates.map(t => [t.name, t]));
    const names = templates.map(t => t.name);
    const { templateName } = await inquirer.prompt([
      {
        name: 'templateName',
        type: 'list',
        choices: names,
        message: 'Choose the template for creating package.',
        default: names[0]
      }
    ]);
    const template = templateMap.get(templateName);
    if (template) {
      const sourcePath = path.join(template.path, 'resource');
      const targetPath = path.join(path.cwd(), ...(payload.paths ?? []));
      task.writeDir(targetPath, { source: sourcePath });
    }
  }
  const pj = payload.packageJson as PackageJson;
  task.writePackage({
    ...payload,
    packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap })
  });
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
  const { payload } = res;
  if (!payload) {
    return {
      content: `Create template "${res.content}" success...`,
      type: 'success'
    };
  }
  const { templateType, setting } = await inquirer.prompt([
    {
      name: 'templateType',
      type: 'list',
      choices: ['package', 'platform'],
      message: 'Choose a package type for your template.',
      default: 'package'
    },
    {
      name: 'setting',
      type: 'confirm',
      message: 'Do you want to set this template to config for usage?',
      default: true
    }
  ]);
  const parents = payload.paths as string[];
  task.writeDir([...parents, 'resource']);
  task.write(
    path.join(path.cwd(), ...parents),
    'index.js',
    templateSupport.buildTemplate(templateType)
  );
  task.writePackage(
    Object.assign(payload, {
      packageJson: {
        ...payload.packageJson,
        main: 'index.js',
        files: ['index.js', 'resource'],
        pmnps: {
          slot: 'template'
        }
      }
    })
  );
  if (setting) {
    task.writeConfig(cfg => {
      const { templates = [] } = cfg;
      const newTemplateSet = new Set([
        ...templates,
        payload.packageJson?.name || ''
      ]);
      return { ...cfg, templates: [...newTemplateSet] };
    });
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
  const templates = hold
    .instance()
    .getTemplates()
    .filter(t => t.projectType === 'platform');
  const rootPackageJson = getRootPackageJson();
  const packageJsonTemplate = omitBy(
    pick(rootPackageJson, 'version', 'author'),
    v => v == null
  );
  const pj: PackageJson = packageJson(
    platformName,
    'platform',
    packageJsonTemplate
  );
  const pmnpsWrap = await setPackageOptions('platform');
  const paths = ['platforms', platformName];
  if (templates.length) {
    const { confirm } = await inquirer.prompt([
      {
        name: 'confirm',
        type: 'confirm',
        message: 'Do you want to create platform with templates?'
      }
    ]);
    if (!confirm) {
      task.writePackage({
        paths,
        packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap }),
        type: 'platform'
      });
      return {
        content: `Create platform "${platformName}" success...`,
        type: 'success'
      };
    }
    const templateMap = new Map(templates.map(t => [t.name, t]));
    const names = templates.map(t => t.name);
    const { templateName } = await inquirer.prompt([
      {
        name: 'templateName',
        type: 'list',
        choices: names,
        message: 'Choose the template for creating platform.',
        default: names[0]
      }
    ]);
    const template = templateMap.get(templateName);
    if (template) {
      const sourcePath = path.join(template.path, 'resource');
      const targetPath = path.join(path.cwd(), ...paths);
      task.writeDir(targetPath, { source: sourcePath });
    }
  }
  task.writePackage({
    paths,
    packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap }),
    type: 'platform'
  });
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

export function createAction(
  argument?: string | null,
  options?: { name?: string }
): Promise<ActionMessage> {
  return createActionResolve(argument, options);
}
