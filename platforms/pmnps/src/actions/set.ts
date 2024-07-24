import { inquirer, type PackageJson } from '@pmnps/tools';
import { hold } from '@/state';
import { setPackageOptions } from '@/actions/create';
import { keyBy, omitBy } from '@/libs/polyfill';
import { task } from '@/actions/task';
import type { ActionMessage } from '@/actions/task/type';

const setTargets = new Set(['package', 'platform']);

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

export async function setAction(
  argument?: string | null
): Promise<ActionMessage> {
  let target = (argument || '').trim();
  if (!setTargets.has(target)) {
    const { target: targetName } = await inquirer.prompt([
      {
        name: 'target',
        type: 'list',
        message: 'Please choose a set target.',
        choices: [...setTargets],
        default: 'package'
      }
    ]);
    target = targetName;
  }
  if (target === 'package') {
    return setPackageAction();
  } else {
    return setPlatformAction();
  }
}
