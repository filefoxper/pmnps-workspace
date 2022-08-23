import { readConfig } from './config';
import { ProjectType, TemplateComponent, TemplatePack } from './type';
import inquirer from 'inquirer';
import { parseRequireName } from './require';

function loadTemplates() {
  const { templates = [] } = readConfig() || {};
  const packs = templates.map(name => {
    const data = require(parseRequireName(name));
    const { path, projectType } = data.default as TemplateComponent;
    return { name, path, projectType } as TemplatePack;
  });
  if (!global.pmnps) {
    throw new Error('Here is a mistake for loading templates');
  }
  global.pmnps.templates = packs;
}

async function selectTemplate(
  projectType: ProjectType
): Promise<null | string> {
  if (!global.pmnps) {
    throw new Error('Here is a mistake for select template');
  }
  const packs = global.pmnps.templates || [];
  const projectPacks = packs.filter(p => p.projectType === projectType);
  if (!projectPacks.length) {
    return null;
  }
  const { used } = await inquirer.prompt([
    {
      name: 'used',
      type: 'confirm',
      message: 'Do you want to use templates in config?'
    }
  ]);
  if (!used) {
    return null;
  }
  const { template } = await inquirer.prompt([
    {
      name: 'template',
      type: 'list',
      message: `Select the template for your ${projectType}:`,
      choices: projectPacks.map(({ name }) => name)
    }
  ]);
  const selectedPack = projectPacks.find(t => t.name === template);
  if (!selectedPack) {
    return null;
  }
  return selectedPack.path;
}

export { loadTemplates };

export default {
  selectTemplate
};
