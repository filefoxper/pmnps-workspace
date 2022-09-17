import {
  PluginPack,
  structure,
  config,
  file,
  StructureNode
} from '@pmnps/core';
import { message } from '@pmnps/tools';

function extractName(
  project: StructureNode,
  childNames: string[] = []
): string[] {
  const name = project.name;
  if (!project.parent || project.parent.type === 'root') {
    return [name, ...childNames];
  }
  return extractName(project.parent, [name, ...childNames]);
}

export default function (): PluginPack {
  return {
    renders: {
      async refresh(): Promise<boolean> {
        const data = config.readConfig();
        if (!data) {
          message.warn('You should initial your project first.');
          return false;
        }
        const { workspace } = data;
        const vscodeWorkspaceName = `${workspace}.code-workspace`;
        structure.rebuild((root, { file }) => {
          const projects = root.filter(
            d => !!d.projectType && d.type === 'dir'
          );
          const data = projects.map(d => {
            const names = extractName(d);
            const name = names.join('/');
            return { name, path: name };
          });
          const folders = [{ name: 'root', path: '.' }, ...data];
          root.write([
            file('.prettierrc.json')
              .write(content => {
                const data = JSON.parse(content);
                const { overrides = [] } = data;
                if (
                  overrides.some(({ files }) => files === '*.code-workspace')
                ) {
                  return content;
                }
                const newOverrides = [
                  ...overrides,
                  { files: '*.code-workspace', options: { parser: 'json' } }
                ];
                const newConfig = { ...data, overrides: newOverrides };
                return JSON.stringify(newConfig);
              })
              .order(['prettier']),
            file(vscodeWorkspaceName, { folders, settings: {} }).order([
              'prettier',
              'git'
            ])
          ]);
        });
        return true;
      }
    }
  };
}
