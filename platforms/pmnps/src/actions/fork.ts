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
  const source = path.join(cwd, ...pathParts);
  task.fork(
    [
      'forks',
      pathname
        .split('/')
        .filter(s => s.trim())
        .join('.')
    ],
    { source }
  );
  return {
    type: 'success',
    content: `Fork package "${pathname}" success`
  };
}
