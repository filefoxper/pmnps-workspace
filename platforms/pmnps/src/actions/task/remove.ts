import { keyBy } from '@/libs/polyfill';
import { file, message } from '@/libs';
import type { RemoveTask, Task } from '@/actions/task/type';

export async function remove(...tasks: Task[]) {
  const removeTasks = tasks as RemoveTask[];
  const map = keyBy(removeTasks, 'path');
  const cleans = [...map].map(([, v]) => v);
  return Promise.all(
    cleans.map(async v => {
      message.log(`remove: ${v.path}`);
      return file.unlink(v.path);
    })
  );
}
