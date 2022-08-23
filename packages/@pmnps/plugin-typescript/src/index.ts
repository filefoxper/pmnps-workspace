import {
  PackageJson,
  PluginType,
  PluginPack,
  RebuildTools,
  structure,
  StructureNode
} from '@pmnps/core';

function renameIndexNode(indexNode: StructureNode | undefined) {
  if (!indexNode) {
    return;
  }
  const { name } = indexNode;
  if (name.endsWith('.js')) {
    indexNode.rename('index.ts');
    return;
  }
  if (name.endsWith('.jsx')) {
    indexNode.rename('index.tsx');
  }
}

function writePackageJsonNode(
  packageJsonNode: StructureNode | undefined,
  indexDExist: boolean,
  tsVersion: string
) {
  if (!packageJsonNode) {
    return;
  }
  packageJsonNode.write(content => {
    const json: PackageJson = JSON.parse(content);
    json.devDependencies = json.devDependencies || {};
    if (indexDExist) {
      json.typings = 'index.d.ts';
      if (json.files) {
        json.files.push('index.d.ts');
      }
    }
    Object.assign(json.devDependencies, { typescript: tsVersion });
    const { module } = json;
    if (
      module &&
      (module.startsWith('index.js') ||
        module.startsWith('./index.js') ||
        module.startsWith('./src/index.js') ||
        module.startsWith('src/index.js'))
    ) {
      json.module = module.replace('index.js', 'index.ts');
    }
    return JSON.stringify(json);
  });
}

function writeTsConfig(
  indexNode: StructureNode | undefined,
  packageJsonNode: StructureNode | undefined,
  { write, file }: RebuildTools
) {
  if (!packageJsonNode || !packageJsonNode.parent) {
    return;
  }
  const compilerOptions = {
    target: 'esnext',
    module: 'esnext',
    lib: ['es2019', 'dom'],
    moduleResolution: 'node',
    resolveJsonModule: true,
    importHelpers: true,
    esModuleInterop: true,
    baseUrl: './',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    paths: {},
    noImplicitAny: false,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    forceConsistentCasingInFileNames: true
  };
  const useReact = indexNode && indexNode.name.endsWith('x');
  const options = useReact
    ? { ...compilerOptions, jsx: 'react' }
    : compilerOptions;

  write(packageJsonNode.parent, [
    file('tsconfig.json', { compilerOptions: options })
  ]);
}

export default function (): PluginPack {
  return {
    requires: ['typescript'],
    isOption: true,
    renders: {
      async create([tsVersion]): Promise<boolean> {
        structure.rebuild((r, tools) => {
          const { file } = tools;
          const created = r.find(
            ({ status, projectType }) => status === 'create' && !!projectType
          );
          if (!created) {
            return;
          }
          const index = created.find(
            ({ name, type }) => name.startsWith('index.') && type === 'file'
          );
          const packageJsonNode = created.find({ name: 'package.json' });

          renameIndexNode(index);
          const shouldCreateIndexDFile =
            !!index &&
            index.parent === created.find({ name: 'src', type: 'dir' });
          if (shouldCreateIndexDFile) {
            created.write([file('index.d.ts')]);
          }
          writePackageJsonNode(
            packageJsonNode,
            shouldCreateIndexDFile,
            tsVersion
          );
          writeTsConfig(index, packageJsonNode, tools);
        });
        return true;
      }
    }
  };
}
