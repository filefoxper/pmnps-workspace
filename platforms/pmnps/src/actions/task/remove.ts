import { keyBy, partition } from '@/libs/polyfill';
import { file, message } from '@/libs';
import type { RemoveTask, Task } from '@/actions/task/type';

export async function remove(...tasks: Task[]) {
  const removeTasks = tasks as RemoveTask[];
  const map = keyBy(removeTasks, 'path');
  const cleans = [...map].map(([, v]) => v);
  const [cleanFiles, cleanDirs] = partition(cleans, t => t.fileType !== 'dir');
  await Promise.all(
    cleanFiles.map(async v => {
      const r = await file.unlink(v.path);
      if (r) {
        message.log(`remove file: ${v.path}`);
      }
      return r;
    })
  );
  await Promise.all(
    cleanDirs.map(async v => {
      const r = await file.rmdir(v.path);
      if (r) {
        message.log(`remove dir: ${v.path}`);
      }
      return r;
    })
  );
}
