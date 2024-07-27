import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { message } from '../message';
import type { transform } from 'esbuild';

function load(pathname: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(pathname);
  } catch (e) {
    message.warn(`Load module "${pathname}" failed...`);
    return null;
  }
}

function read(pathname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(pathname, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const content = data.toString('utf-8');
      resolve(content);
    });
  });
}

async function loadTs(pathname: string) {
  const content = await read(pathname);
  const esbuild: { transform: typeof transform } | null = load('esbuild');
  if (esbuild == null) {
    message.warn('Please install "esbuild" for building a ts plugin...');
    return null;
  }
  try {
    const { code } = await esbuild.transform(content, {
      loader: 'ts',
      target: 'node16',
      platform: 'node',
      format: 'cjs',
      logLevel: 'info'
    });
    const sandbox = {
      module: { exports: {} },
      require: (id: string) => require(id)
    };
    vm.runInNewContext(code, sandbox);
    return sandbox.module.exports as null | Record<string, any>;
  } catch (e) {
    message.error('Use "esbuild" built ts plugin failed...');
    return null;
  }
}

export function requireFactory(cwd: string, onlyJsModule?: boolean) {
  return {
    require: async (
      pathname: string
    ): Promise<{ pathname: string; module: any }> => {
      const names = pathname.split('/');
      const requiredPathname = (function computeRequiredPathname() {
        const requiredNodeModulesPathname = path.join(
          cwd,
          'node_modules',
          ...names
        );
        const requiredWorkspacePathname = path.join(cwd, 'packages', ...names);
        const requiredRelativePathname = path.join(cwd, ...names);
        const requiredAbsolutePathname = path.join(...names);
        if (fs.existsSync(requiredWorkspacePathname)) {
          return requiredWorkspacePathname;
        }
        if (fs.existsSync(requiredNodeModulesPathname)) {
          return requiredNodeModulesPathname;
        }
        if (fs.existsSync(requiredRelativePathname)) {
          return requiredRelativePathname;
        }
        if (fs.existsSync(requiredAbsolutePathname)) {
          return requiredAbsolutePathname;
        }
        return null;
      })();
      if (requiredPathname == null) {
        message.warn(`Load module "${pathname}" failed...`);
        return { pathname, module: null };
      }
      if (requiredPathname.endsWith('.js')) {
        return { pathname, module: load(requiredPathname) };
      }
      if (requiredPathname.endsWith('.ts')) {
        if (onlyJsModule) {
          message.warn(
            `Can not load a ts module "${pathname}" for pmnps is working in a performance first mode...`
          );
          return { pathname, module: null };
        }
        const m = await loadTs(requiredPathname);
        return { pathname, module: m };
      }
      return { pathname, module: load(requiredPathname) };
    }
  };
}
