import path from 'path';
import { createPluginCommand } from '@pmnps/tools';
import type { Plugin } from '@pmnps/tools';

interface Query {
  excludes?: Array<string>;
  shortcut?: boolean;
}

const refreshVscodeWorkspace: Plugin<Query> = function refreshVscodeWorkspace(
  query?: Query
) {
  const slot = createPluginCommand('refresh');
  return slot
    .require(async state => {
      const { name: workspace, projectType } = state.getConfig();
      const vscodeWorkspaceName = `${workspace}.code-workspace`;
      const cwd = state.cwd();
      return state.reader.readJson(path.join(cwd, vscodeWorkspaceName));
    })
    .action(async state => {
      const fetchingStale = state.required;
      const stale = await fetchingStale;
      const { name: workspace, projectType } = state.getConfig();
      const { project } = state.getProject();
      const task = state.task;
      const { excludes = [], shortcut = true } = query || {};
      const { packages = [], platforms = [] } = project;
      const vscodeWorkspaceName = `${workspace}.code-workspace`;
      const data = [...packages, ...platforms].map(d => {
        const name = d.name;
        const p =
          d.type === 'package'
            ? ['packages', ...name.split('/')].join('/')
            : ['platforms', ...name.split('/')].join('/');
        return { name: shortcut ? name : p, path: p };
      });
      const folders = [{ name: 'root', path: '.' }, ...data].filter(
        ({ name }) => !excludes.some(e => name.startsWith(e))
      );
      const result = { folders, settings: {} };
      if (stale && JSON.stringify(stale) === JSON.stringify(result)) {
        return {
          type: 'success',
          content: 'Vscode workspace refresh success...'
        };
      }
      task.write(state.cwd(), vscodeWorkspaceName, result);
      return {
        type: 'success',
        content: 'Vscode workspace refresh success...'
      };
    });
};

export default refreshVscodeWorkspace;
