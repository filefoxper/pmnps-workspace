import path from 'path';
import { createPluginCommand } from '@pmnps/tools';
import type { Plugin } from '@pmnps/tools';

const cleanNodeModules: Plugin<any> = function cleanNodeModules() {
  const slot = createPluginCommand('refresh');
  return slot.action(async state => {
    const coreChanged = state.isCoreChanged();
    if (!coreChanged) {
      return {
        type: 'success',
        content: 'Skip clear node_modules.'
      };
    }
    const { project } = state.getProject();
    const { workspace, platforms = [], packages = [] } = project;
    const packs = workspace ? [...packages, ...platforms, workspace] : [];
    const map = new Map(packs.map(p => [p.name, p.path]));
    const lockState = state.getLockState();
    Object.entries(lockState)
      .filter(([, v]) => v.hasNodeModules)
      .forEach(([k]) => {
        const pathname = map.get(k);
        if (!pathname) {
          return;
        }
        state.task.remove(path.join(pathname, 'node_modules'), {
          fileType: 'dir'
        });
      });
    return {
      type: 'success',
      content: 'Clean node_modules success...'
    };
  });
};

export default cleanNodeModules;
