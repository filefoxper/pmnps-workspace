import { projectSupport } from '@/support';
import type { Command, Package, Project } from '@pmnps/tools';
import type { Task } from '@/actions/task/type';
import type { Resource, State, Template } from '@/types';

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
    setResources(resources: Partial<Resource>) {
      global.pmnps.resources = global.pmnps.resources || {};
      Object.assign(global.pmnps.resources, resources);
    },
    load(withCache?: boolean) {
      return global.pmnps.load(withCache);
    },
    setTemplates(templates: Template[]) {
      global.pmnps.resources.templates = templates;
    },
    getTemplates() {
      return global.pmnps.resources.templates;
    },
    setCommands(commands: Command[]) {
      global.pmnps.resources.commands = commands;
    },
    getCommands() {
      return global.pmnps.resources.commands;
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
    getTasks() {
      return global.pmnps.tasks || [];
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
    diffDepsPackages(skipCompare?: boolean) {
      const { cacheProject: target, project: source } = global.pmnps.state;
      const { project } = source ?? {
        project: { workspace: undefined, packages: [], platforms: [] }
      };
      const {
        workspace,
        packages = [],
        platforms = []
      } = project as Project['project'];
      if (target == null) {
        return {
          packs: [workspace, ...packages, ...platforms].filter(
            (d): d is Package => !!d
          ),
          isEmpty: true
        };
      }
      if (skipCompare) {
        return {
          packs: [workspace, ...packages, ...platforms].filter(
            (d): d is Package => !!d
          )
        };
      }
      const map = projectSupport.diffDepsPackagesMap(source, target);
      return {
        packs: [workspace, ...packages, ...platforms].filter(
          (d): d is Package => {
            if (!d) {
              return false;
            }
            return !!map[d.path];
          }
        )
      };
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

hold.plugin = {
  getProject: () => hold.instance().getState().project,
  getConfig: () => hold.instance().getState().config
};
