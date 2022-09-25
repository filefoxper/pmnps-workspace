import { PluginPack, structure, config, StructureNode } from '@pmnps/core';
import { message } from '@pmnps/tools';
import prettier from 'prettier';

type Query = {
  excludes: Array<string>;
};

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

export default function (query?: Query): PluginPack {
  return {
    renders: {
      async refresh(): Promise<boolean> {
        const data = config.readConfig();
        if (!data) {
          message.warn('You should initial your project first.');
          return false;
        }
        const { workspace } = data;
        const { excludes = [] } = query || {};
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
          const folders = [{ name: 'root', path: '.' }, ...data].filter(
            ({ name }) => !excludes.some(e => name.startsWith(e))
          );
          root.write([
            file(vscodeWorkspaceName, { folders, settings: {} })
              .write(d => {
                const data = JSON.parse(d);
                return prettier.format(JSON.stringify({ ...data, folders }),{ parser: 'json' });
              })
              .order(['git'])
          ]);
        });
        return true;
      }
    }
  };
}
