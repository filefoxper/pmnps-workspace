import os from 'os';
import path from 'path';
import { inquirer, type PackageJson } from '@pmnps/tools';
import { hold } from '@/state';
import { setPackageOptions } from '@/actions/create';
import { keyBy, omitBy } from '@/libs/polyfill';
import { task } from '@/actions/task';
import { getPluginState } from '@/plugin';
import type { ActionMessage } from '@/actions/task/type';

const setTargets = ['package', 'platform'];

export async function setPackageAction(
  argument?: string | null
): Promise<ActionMessage> {
  let packageName = (argument || '').trim();
  const { project } = hold.instance().getState();
  const packages = project?.project.packages || [];
  if (!packages.length) {
    return {
      type: 'warning',
      content: 'No package has been found.'
    };
  }
  const choices = packages.map(d => d.name);
  const choiceMap = keyBy(packages, 'name');
  if (!packageName || choices.indexOf(packageName) < 0) {
    const { target: targetName } = await inquirer.prompt([
      {
        name: 'target',
        type: 'list',
        message: 'Please choose a package for setting.',
        choices: choices,
        default: choices[0]
      }
    ]);
    packageName = targetName;
  }
  const targetPackage = choiceMap.get(packageName);
  const pmnpsSetting = await setPackageOptions('package');
  const pmnpsWrap = omitBy(pmnpsSetting, (value, key) => value == null);
  if (targetPackage == null) {
    return {
      type: 'warning',
      content: 'The selected package is not exist.'
    };
  }
  const pj = targetPackage.packageJson as PackageJson;
  task.writePackage({
    ...targetPackage,
    packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap })
  });
  return {
    type: 'success',
    requireRefresh: true,
    content: `Package ${packageName} is set success.`
  };
}

export async function setPlatformAction(
  argument?: string | null
): Promise<ActionMessage> {
  let platformName = (argument || '').trim();
  const { project } = hold.instance().getState();
  const platforms = project?.project.platforms || [];
  if (!platforms.length) {
    return {
      type: 'warning',
      content: 'No platform has been found.'
    };
  }
  const choices = platforms.map(d => d.name);
  const choiceMap = keyBy(platforms, 'name');
  if (!platformName || choices.indexOf(platformName) < 0) {
    const { target: targetName } = await inquirer.prompt([
      {
        name: 'target',
        type: 'list',
        message: 'Please choose a platform for setting.',
        choices: choices,
        default: choices[0]
      }
    ]);
    platformName = targetName;
  }
  const targetPlatform = choiceMap.get(platformName);
  const pmnpsSetting = await setPackageOptions('platform');
  const pmnpsWrap = omitBy(pmnpsSetting, (value, key) => value == null);
  if (targetPlatform == null) {
    return {
      type: 'warning',
      content: 'The selected package is not exist.'
    };
  }
  const pj = targetPlatform.packageJson as PackageJson;
  task.writePackage({
    ...targetPlatform,
    packageJson: p => (p == null ? pj : { ...p, ...pj, ...pmnpsWrap })
  });
  return {
    type: 'success',
    requireRefresh: true,
    content: `Platform ${platformName} is set success.`
  };
}

async function readSystemProfile(file: string) {
  const dir = os.homedir();
  const zshrcPath = path.join(dir, '.zshrc');
  const zshrc = await getPluginState().reader.read(zshrcPath);
  return {
    path: zshrcPath,
    dir,
    file,
    content: zshrc || ''
  };
}

export async function setAliasAction(
  argument?: string | null
): Promise<ActionMessage> {
  const plat = global.pmnps.platform;
  if (plat !== 'darwin') {
    return {
      type: 'failed',
      content: 'Command set:alias can only work on `darwin` system.'
    };
  }
  const { file, dir, content } = await readSystemProfile('.zshrc');
  let argString = (argument || '').trim();
  if (!argument || !argument.trim()) {
    const { arg } = await inquirer.prompt([
      {
        name: 'arg',
        type: 'input',
        message: 'Please enter an alias name for pmnpx:'
      }
    ]);
    argString = arg.trim();
  }
  const args = argString.trim();
  if (!args) {
    return {
      type: 'warning',
      content: 'No alias setting is input.'
    };
  }
  const addition = `alias ${args}=pmnpx`;
  const nextContent = (function rewriteContent() {
    if (content.indexOf(addition) >= 0) {
      return content;
    }
    if (!content || !content.trim()) {
      return addition;
    }
    return content.trim().concat('\n').concat(addition);
  })();
  if (content === nextContent) {
    return {
      type: 'success',
      content: 'This command alias is already exist.'
    };
  }
  task.write(dir, file, nextContent);
  return {
    type: 'success',
    content: 'This command alias has been linked.'
  };
}

export async function setAction(
  argument?: string | null
): Promise<ActionMessage> {
  let target = (argument || '').trim();
  const canUseAlias = !!global.pmnps.px && global.pmnps.platform === 'darwin';
  const setTargetArray = canUseAlias ? [...setTargets, 'alias'] : setTargets;
  const setTargetSet = new Set(setTargetArray);
  if (!setTargetSet.has(target)) {
    const { target: targetName } = await inquirer.prompt([
      {
        name: 'target',
        type: 'list',
        message: 'Please choose a set target.',
        choices: setTargetArray,
        default: 'package'
      }
    ]);
    target = targetName;
  }
  if (target === 'package') {
    return setPackageAction();
  } else if (target === 'platform') {
    return setPlatformAction();
  } else {
    return setAliasAction();
  }
}
