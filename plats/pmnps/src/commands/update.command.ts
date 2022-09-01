import { Command } from 'commander';
import { executeContext, message } from '@pmnps/tools';
import { inquirer, path, structure } from '@pmnps/core';
import { refreshAction } from './refresh.command';

type VersionUpdateMode = '*.*.v' | '*.v.*' | 'v.*.*';

function updateVersionByMode(version: string, mode: VersionUpdateMode): string {
  const index = mode.split('.').indexOf('v');
  const parts = version.match(/\d+/g);
  if (!parts) {
    return version;
  }
  const newParts = parts.map((p, i) => {
    if (i < index) {
      return Number(p);
    }
    if (i === index) {
      return Number(p) + 1;
    }
    return 0;
  });
  return newParts.slice(0, 3).join('.');
}

function updateVersions(range: string[], mode: VersionUpdateMode) {
  const rangeSet = new Set(range);
  const { root, packages, platforms } = structure.packageJsons();
  const pjs = packages.concat(platforms).concat(root ? [root] : []);
  const jsons = pjs.filter(({ name }) => !!name && rangeSet.has(name));
  const jsonSet = new Set(
    jsons.map(j => path.join(j.getDirPath?.(), 'package.json'))
  );
  structure.rebuild(r => {
    const nodes = r.filter(node => {
      return jsonSet.has(node.path);
    });
    nodes.forEach(node => {
      node.write(content => {
        const pc = JSON.parse(content);
        const version = updateVersionByMode(pc.version, mode);
        const newPc = { ...pc, version };
        return JSON.stringify(newPc);
      });
    });
  });
  return [...jsonSet];
}

async function updateAction() {
  message.desc(
    'You can update the versions of `platforms`&`packages` by using this command.'
  );
  message.desc('ex. `*.*.v` = `0.0.1`->`0.0.2`');
  message.desc('ex. `*.v.*` = `0.1.0`->`0.2.0`');
  message.desc('ex. `v.*.*` = `1.0.0`->`2.0.0`');
  const { mode } = await inquirer.prompt([
    {
      name: 'mode',
      type: 'list',
      message: 'Select the version part you want to update:',
      choices: ['*.*.v', '*.v.*', 'v.*.*']
    }
  ]);
  const { root, packages, platforms } = structure.packageJsons();
  const packageNames = packages.map(({ name }) => name);
  const platformNames = platforms.map(({ name }) => name);
  let rangeNames = packageNames
    .concat(platformNames)
    .concat(root ? [root.name] : []);
  if (mode === '*.*.v' || mode === '*.v.*') {
    const { jsons:rs } = await inquirer.prompt([
      {
        name: 'jsons',
        type: 'checkbox',
        message: `Choose the packages and platforms you want to update (${mode}) :`,
        choices: [
          new inquirer.Separator('=== packages ==='),
          ...packageNames,
          new inquirer.Separator('=== platforms ==='),
          ...platformNames
        ]
      }
    ]);
    rangeNames = rs;
  }
  if (!rangeNames.length) {
    message.warn('You should choose the update scope of packages & platforms.');
    return;
  }
  const jsons = updateVersions(rangeNames, mode as VersionUpdateMode);
  await structure.flush();
  await Promise.all([
    executeContext(({ npx }) => {
      return npx(['prettier', '--write', ...jsons], { cwd: path.rootPath });
    }),
    refreshAction()
  ]);
}

function commandUpdate(program: Command) {
  program
    .command('update')
    .description('Update the version of `platforms`&`packages`.')
    .action(updateAction);
}

export { commandUpdate, updateAction };
