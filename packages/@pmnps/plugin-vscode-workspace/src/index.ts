import path from 'path';
import { createPluginCommand } from '@pmnps/tools';
import type { Plugin, Package } from '@pmnps/tools';

interface Query {
  excludes?: Array<string>;
  shortcut?: boolean;
  shrinkScope?: boolean;
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
      return state.reader.readJson(path.join(cwd, vscodeWorkspaceName)).then(
        d => d,
        e => null
      );
    })
    .action(async state => {
      const fetchingStale = state.required;
      const stale = await fetchingStale;
      const { name: workspace, projectType } = state.getConfig();
      const { project } = state.getProject();
      const task = state.task;
      const { excludes = [], shortcut = true, shrinkScope } = query || {};
      const { packages = [], platforms = [], scopes = [] } = project;
      const vscodeWorkspaceName = `${workspace}.code-workspace`;
      const resolvedPackageOrScopes = (function resolvePackages() {
        if (!shrinkScope) {
          return packages;
        }
        const packageInScopes = scopes.flatMap(s => s.packages);
        const packageInScopeSet = new Set(packageInScopes.map(p => p.name));
        const outPackages = packages.filter(
          p => !packageInScopeSet.has(p.name)
        );
        return [...scopes, ...outPackages];
      })();
      const data = [...resolvedPackageOrScopes, ...platforms].map(d => {
        const name = d.name;
        const pk = d as Package;
        const p = (pk.paths ?? []).join('/');
        return { name: shortcut ? name : p, path: p };
      });
      const defaults = [
        { name: 'package.json', path: 'package.json' },
        { name: '.pmnpsrc.json', path: '.pmnpsrc.json' }
      ];
      const folders = [
        { name: '<workspaces>', path: '.' },
        ...data,
        ...defaults
      ].filter(({ name }) => !excludes.some(e => name.startsWith(e)));
      const result = { folders, settings: {} };
      if (stale && JSON.stringify(stale) === JSON.stringify(result)) {
        return {
          type: 'success',
          content: 'Refresh vscode workspace success...'
        };
      }
      task.write(state.cwd(), vscodeWorkspaceName, result);
      return {
        type: 'success',
        content: 'Refresh vscode workspace success...'
      };
    });
};

export default refreshVscodeWorkspace;
