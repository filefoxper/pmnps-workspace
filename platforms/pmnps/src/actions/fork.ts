import { inquirer } from '@pmnps/tools';
import { path } from '@/libs';
import { task } from '@/actions/task';
import type { ActionMessage } from '@/actions/task/type';

export async function forkAction(args?: string | null): Promise<ActionMessage> {
  let pathname = args;
  if (pathname == null) {
    const { pack } = await inquirer.prompt([
      {
        name: 'pack',
        type: 'input',
        message: 'Please enter the package name:'
      }
    ]);
    pathname = pack ? pack.trim() : null;
  }
  if (pathname == null || !pathname.trim()) {
    return {
      type: 'warning',
      content:
        'Please provide a relative url to the fork package in node_modules folder.'
    };
  }
  const cwd = path.cwd();
  const pathParts = pathname
    .trim()
    .split('/')
    .map(p => p.trim());
  const nameParts = pathname.split('node_modules/');
  const targetName = nameParts[nameParts.length - 1];
  const source = path.join(cwd, ...pathParts);
  task.fork(['forks', ...targetName.split('/')], { source });
  return {
    type: 'success',
    content: `Fork package "${pathname}" success`
  };
}
