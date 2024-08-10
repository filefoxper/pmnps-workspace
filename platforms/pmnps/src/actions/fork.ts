import { inquirer } from '@pmnps/tools';
import { path } from '@/libs';
import { task } from '@/actions/task';
import type { ActionMessage } from '@/actions/task/type';

export async function forkAction(
  args?: string | null,
  options?: { to?: string; omits?: string }
): Promise<ActionMessage> {
  const { to, omits } = options ?? {};
  let pathname = args;
  if (pathname == null) {
    const { pack } = await inquirer.prompt([
      {
        name: 'pack',
        type: 'input',
        message: 'Please enter the package source path:'
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
  let targetPathname = to ?? pathname;
  if (!args && (to == null || !to.trim())) {
    const { confirm } = await inquirer.prompt([
      {
        name: 'confirm',
        type: 'confirm',
        message: 'Is the source package path is the target package path?',
        default: true
      }
    ]);
    if (!confirm) {
      const { target } = await inquirer.prompt([
        {
          name: 'target',
          type: 'input',
          message: 'Please enter the target path:'
        }
      ]);
      targetPathname = target;
    }
  }
  const cwd = path.cwd();
  const pathParts = pathname
    .trim()
    .split('/')
    .map(p => p.trim());
  const source = path.join(cwd, ...pathParts);
  task.fork(
    targetPathname.split('/').filter(s => s.trim()),
    { source, omits: omits ? omits.split(',') : undefined }
  );
  return {
    type: 'success',
    content: `Fork package "${pathname}" success`
  };
}
