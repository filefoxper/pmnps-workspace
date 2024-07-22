import os from 'os';
import path from 'path';
import { createPluginCommand, inquirer } from '@pmnps/tools';

type Option = {
  remove?: string;
};

function parseCommandAlias(args: string) {
  const data = args
    .trim()
    .split('=')
    .map(a => a.trim())
    .filter(a => a);
  if (data.length !== 2) {
    return null;
  }
  const [alias, command] = data;
  return [alias, command] as [string, string];
}

const alias = function alias() {
  const slot = createPluginCommand('alias');
  return slot
    .require(async state => {
      const plat = os.platform();
      if (plat !== 'darwin') {
        return null;
      }
      const file = '.zshrc';
      const dir = os.homedir();
      const zshrcPath = path.join(dir, '.zshrc');
      const zshrc = await state.reader.read(zshrcPath);
      return {
        path: zshrcPath,
        dir,
        file,
        content: zshrc
      };
    })
    .args('pair', 'Enter `<alias>=<command>`')
    .option('remove', 'r', {
      description: 'Remove the input matched command alias',
      inputType: '<alias>=<command>'
    })
    .action(async (state, argument, option: unknown) => {
      const required: null | {
        path: string;
        dir: string;
        file: string;
        content: string;
      } = await state.required;
      if (required == null) {
        return {
          type: 'warning',
          content: 'Pmnps plugin-alias only support darwin system now.'
        };
      }
      const { dir, file, content } = required;
      const { remove } = (option || {}) as Option;
      const removeString = remove || '';
      const removeAlias = removeString.trim();
      if (removeAlias) {
        const d = parseCommandAlias(removeAlias);
        if (d == null) {
          return {
            type: 'warning',
            content:
              'The remove option alias setting is invalid, please use this pattern: <alias>=<command>.'
          };
        }
        const [a, c] = d;
        const aliasCommand = `alias ${a}=${c}`;
        if (content.indexOf(aliasCommand) < 0) {
          return {
            type: 'success',
            content: 'This command alias has been removed.'
          };
        }
        const next = content
          .split(aliasCommand)
          .filter(s => s.trim())
          .join('\n');
        state.task.write(dir, file, next);
        return {
          type: 'success',
          content: 'This command alias has been removed.'
        };
      }
      let argString = (argument || '').trim();
      if (!argument || !argument.trim()) {
        const { arg } = await inquirer.prompt([
          {
            name: 'arg',
            type: 'input',
            message: 'Please enter alias setting like `<alias>=<command>`:'
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
      const parsedArgs = parseCommandAlias(args);
      if (parsedArgs == null) {
        return {
          type: 'warning',
          content:
            'The alias setting is invalid, please use this pattern: <alias>=<command>.'
        };
      }
      const [alias, command] = parsedArgs;
      const addition = `alias ${alias}=${command}`;
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
      state.task.write(dir, file, nextContent);
      return {
        type: 'success',
        content: 'This command alias has been linked.'
      };
    });
};

export default alias;
