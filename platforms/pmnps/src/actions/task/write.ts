import { file, message, path } from '@/libs';
import { groupBy, orderBy, partition } from '@/libs/polyfill';
import { hold } from '@/state';
import type { Execution, Task, WriteTask } from './type';

async function writeTask(task: Task) {
  const { type } = task;
  if (type !== 'write') {
    return [];
  }
  const { path: pathname, file: fileName, content, option, cwd } = task;
  const { formatter, skipIfExist, command } = option ?? {};
  const data = typeof content === 'string' ? content : JSON.stringify(content);
  const d = await Promise.resolve(formatter ? formatter(data) : data);
  const filePath = path.join(pathname, fileName);
  message.log(`write: ${filePath}`);
  if (skipIfExist) {
    await file.createFile(filePath, d);
  }
  await file.writeFile(filePath, d);
  if (command == null || command.length === 0) {
    return [];
  }
  return command.map(ex => {
    return {
      command: [...ex, filePath],
      cwd
    } as Execution;
  });
}

async function readContent(p: string, fileName: string) {
  const { project } = hold.instance().getState();
  const packageMap = project?.packageMap ?? {};
  if (fileName === 'package.json' && packageMap[p]?.packageJson) {
    return JSON.stringify(packageMap[p]?.packageJson);
  }
  return file.readFile(path.join(p, fileName));
}

async function copydirs(tasks: WriteTask[]) {
  const [copyTasks, createTasks] = partition(tasks, t => !!t.dirSource);
  const map = new Map(copyTasks.map(t => [t.path, t]));
  await Promise.all(
    [...map.keys()].map(async p => {
      const t = map.get(p);
      if (!t || !t.dirSource) {
        return undefined;
      }
      const { dirSource, filter, force, option } = t;
      const r = await file.copyFolder(dirSource, t.path, { filter, force });
      const finish = option?.onFinish ?? (() => Promise.resolve(undefined));
      await finish();
      return r;
    })
  );
  return createTasks.filter(t => !map.has(t.path));
}

async function mkdirs(tasks: WriteTask[]) {
  const { cacheProject } = hold.instance().getState();
  const map = cacheProject?.packageMap ?? {};
  const pathMap = new Map(tasks.map(d => [d.path, d]));
  const paths = [...pathMap.keys()].filter(p => !map[p]);
  const sorted = orderBy(paths, [p => p.length], ['desc']);
  const result: string[] = [];
  let array = sorted;
  while (array.length) {
    const start = array.shift();
    if (start != null) {
      array = array.filter(d => start !== d && !start.startsWith(d));
      result.push(start);
    }
  }
  return Promise.all(
    result.map(d => {
      const t = pathMap.get(d);
      if (t == null) {
        return Promise.resolve(undefined);
      }
      const { dirSource } = t;
      if (dirSource) {
        return file.copyFolder(dirSource, d);
      }
      return file.mkdirIfNotExist(d);
    })
  );
}

export async function write(...task: Task[]) {
  const tasks = task as WriteTask[];
  const [fileTasks, dirTasks] = partition(tasks, t => t.fileType === 'file');
  const createDirTasks = await copydirs(dirTasks);
  const groups = groupBy(fileTasks, t => path.join(t.path, t.file));
  const taskReaders = [...groups.values()].map(async group => {
    const [start, ...rest] = group;
    if (typeof start.content === 'function') {
      const c = await readContent(start.path, start.file);
      const s = { ...start, content: start.content(c) };
      const finallyFunctionContentStartTask = rest.reduce((r, current) => {
        const option = { ...r.option, ...current.option };
        if (typeof current.content === 'function') {
          return {
            ...r,
            content: current.content(
              typeof r.content !== 'string' ? '' : r.content
            ),
            option
          };
        }
        return { ...r, content: current.content, option };
      }, s);
      if (
        c === finallyFunctionContentStartTask.content &&
        typeof s.content !== 'function'
      ) {
        return null;
      }
      return finallyFunctionContentStartTask;
    } else {
      return rest.reduce((r, current) => {
        const option = { ...r.option, ...current.option };
        if (typeof current.content === 'function') {
          return {
            ...r,
            content: current.content(
              typeof r.content !== 'string' ? '' : r.content
            ),
            option
          };
        }
        return { ...r, content: current.content, option };
      }, start);
    }
  });
  const ts = await Promise.all(taskReaders);
  const fileWrites = ts.filter((d): d is WriteTask => !!d && d.content != null);
  await mkdirs([...fileWrites, ...createDirTasks]);
  return Promise.all(fileWrites.map(writeTask));
}
