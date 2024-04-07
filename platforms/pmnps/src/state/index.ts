import { projectSupport } from '@/support';
import type { Task } from '@/actions/task/type';
import type { Package, Project, State } from '@/types';

export function hold() {
  const listeners: (() => void)[] = [];
  return {
    getState() {
      return global.pmnps.state;
    },
    setState(state: Partial<State> | ((state: State) => State)) {
      const s = typeof state === 'function' ? state(global.pmnps.state) : state;
      Object.assign(global.pmnps.state, s);
      return global.pmnps.state;
    },
    load(withCache?: boolean) {
      return global.pmnps.load(withCache);
    },
    pushTask(task: Task) {
      global.pmnps.tasks.push(task);
      return global.pmnps.tasks;
    },
    consumeTasks() {
      const tasks = [...global.pmnps.tasks];
      global.pmnps.tasks = [];
      return tasks;
    },
    diffProjectPackages() {
      const { cacheProject: target, project: source } = global.pmnps.state;
      const map = projectSupport.diffProjectPackageMap(source, target);
      const { project } = source ?? {
        project: { workspace: undefined, packages: [], platforms: [] }
      };
      const {
        workspace,
        packages = [],
        platforms = []
      } = project as Project['project'];
      return [workspace, ...packages, ...platforms].filter(
        (d): d is Package => {
          if (!d) {
            return false;
          }
          return !!map[d.path];
        }
      );
    },
    diffDepsPackages() {
      const { cacheProject: target, project: source } = global.pmnps.state;
      const map = projectSupport.diffDepsPackagesMap(source, target);
      const { project } = source ?? {
        project: { workspace: undefined, packages: [], platforms: [] }
      };
      const {
        workspace,
        packages = [],
        platforms = []
      } = project as Project['project'];
      return [workspace, ...packages, ...platforms].filter(
        (d): d is Package => {
          if (!d) {
            return false;
          }
          return !!map[d.path];
        }
      );
    },
    subscribe(listener: () => void) {
      listeners.push(listener);
      return () => {
        const i = listeners.findIndex(l => l === listener);
        if (i < 0) {
          return;
        }
        listeners.splice(i, 1);
      };
    }
  };
}

hold.instance = function instance() {
  return global.pmnps.holder;
};
