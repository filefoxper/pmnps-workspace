import {
  PackageJson,
  PluginPack,
  structure,
  StructureNode,
  inquirer
} from '@pmnps/core';

function renameIndexNode(indexNode: StructureNode | undefined) {
  if (!indexNode) {
    return;
  }
  const { name } = indexNode;
  if (name.endsWith('.js')) {
    indexNode.rename('index.jsx');
    return;
  }
  if (name.endsWith('.ts')) {
    indexNode.rename('index.tsx');
  }
}

function writePackageJsonNode(
  packageJsonNode: StructureNode | undefined,
  changeIndex: boolean,
  versions: Record<string, string>,
  typeVersions?: Record<string, string>
) {
  if (!packageJsonNode) {
    return;
  }
  packageJsonNode.write(content => {
    const json: PackageJson = JSON.parse(content);
    json.dependencies = json.dependencies || {};
    Object.assign(json.dependencies, versions, { ...typeVersions });
    const { module } = json;
    if (
      changeIndex &&
      module &&
      (module.startsWith('index.') ||
        module.startsWith('./index.') ||
        module.startsWith('./src/index.') ||
        module.startsWith('src/index.'))
    ) {
      json.module = module + 'x';
    }
    return JSON.stringify(json);
  });
}

function writeTsConfig(tsconfigNode: StructureNode) {
  tsconfigNode.write(c => {
    const tsconfig = JSON.parse(c);
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.jsx = 'react';
    return JSON.stringify(tsconfig);
  });
}

export default function (): PluginPack {
  return {
    requires: ['react', 'react-dom', '@types/react', '@types/react-dom'],
    isOption: true,
    renders: {
      async create([rv, rdv, trv, trdv]): Promise<boolean> {
        const { changeIndex } = await inquirer.prompt([
          {
            name: 'changeIndex',
            type: 'confirm',
            message:
              'Do you want to change the index file name to `index.jsx` or `index.tsx`?'
          }
        ]);
        structure.rebuild((root, tools) => {
          const created = root.find(
            ({ status, projectType }) => status === 'create' && !!projectType
          );
          if (!created) {
            return;
          }
          const index = created.find(
            ({ name, type }) =>
              (name === 'index.js' || name === 'index.ts') && type === 'file'
          );
          const packageJsonNode = created.find({ name: 'package.json' });

          const tsconfigNode = created.find({ name: 'tsconfig.json' });

          if (changeIndex) {
            renameIndexNode(index);
          }

          writePackageJsonNode(
            packageJsonNode,
            changeIndex,
            {
              react: rv,
              'react-dom': rdv
            },
            tsconfigNode
              ? {
                  '@types/react': trv,
                  '@types/react-dom': trdv
                }
              : undefined
          );
          if (tsconfigNode) {
            writeTsConfig(tsconfigNode);
          }
        });
        return true;
      }
    }
  };
}
