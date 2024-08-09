import fs from 'fs';
import jsyaml from 'js-yaml';
import { path } from '../path';

async function stat(pathname: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(pathname, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stats);
    });
  });
}

async function isFile(pathname: string): Promise<boolean> {
  const exist = fs.existsSync(pathname);
  if (!exist) {
    return false;
  }
  const fileStats = await stat(pathname);
  return fileStats.isFile();
}

async function isDirectory(pathname: string): Promise<boolean> {
  const exist = fs.existsSync(pathname);
  if (!exist) {
    return false;
  }
  const fileStats = await stat(pathname);
  return fileStats.isDirectory();
}

async function readdir(dirPath: string): Promise<string[]> {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(files);
    });
  });
}

async function mkdir(dirPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirPath, { recursive: true }, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(true);
    });
  });
}

async function mkdirIfNotExist(dirPath: string): Promise<boolean> {
  const isDir = await isDirectory(dirPath);
  if (!isDir) {
    return mkdir(dirPath);
  } else {
    return false;
  }
}

async function readFile(locationPath: string): Promise<string | null> {
  const ifFile = await isFile(locationPath);
  if (!ifFile) {
    return null;
  }
  return new Promise((resolve, reject) => {
    fs.readFile(locationPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const content = data.toString('utf-8');
      resolve(content);
    });
  });
}

async function writeFile(locationPath: string, data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.writeFile(locationPath, data, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

async function createFile(filePath: string, content = ''): Promise<string> {
  if (fs.existsSync(filePath)) {
    return content;
  }
  return writeFile(filePath, content);
}

function isSymlink(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.lstat(filePath, (err, stats) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(stats.isSymbolicLink());
    });
  });
}

function isInvalidSymlink(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.lstat(filePath, (err, stats) => {
      if (err) {
        resolve(false);
        return;
      }
      const ifSymlink = stats.isSymbolicLink();
      if (!ifSymlink) {
        resolve(false);
        return;
      }
      const exist = fs.existsSync(fs.realpathSync(filePath));
      resolve(!exist);
    });
  });
}

async function unlink(filePath: string): Promise<boolean> {
  const [file, symlink] = await Promise.all([
    isFile(filePath),
    isSymlink(filePath)
  ]);
  if (!file && !symlink) {
    return false;
  }
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(true);
    });
  });
}

async function rename(
  sourcePath: string,
  targetPath: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.rename(sourcePath, targetPath, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(true);
    });
  });
}

async function rmdir(filePath: string): Promise<boolean> {
  if(!fs.existsSync(filePath)){
    return false;
  }
  return new Promise((resolve, reject) => {
    fs.rm(filePath, { recursive: true }, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(true);
    });
  });
}

async function createFileIfNotExist(
  filePath: string,
  content = ''
): Promise<void> {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    await createFile(filePath, content);
  }
}

async function readYaml<T extends Record<string, any>>(
  locationPath: string
): Promise<T | undefined> {
  const file = await isFile(locationPath);
  if (!file) {
    return undefined;
  }
  return new Promise<T>((resolve, reject) => {
    fs.readFile(locationPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const content = data.toString('utf-8');
      if (!content.trim()) {
        resolve({} as T);
        return;
      }
      resolve(jsyaml.load(content) as T);
    });
  });
}

async function readJson<T extends Record<string, any>>(
  locationPath: string
): Promise<T | undefined> {
  const file = await isFile(locationPath);
  if (!file) {
    return undefined;
  }
  return new Promise<T>((resolve, reject) => {
    fs.readFile(locationPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const content = data.toString('utf-8');
      if (!content.trim()) {
        resolve({} as T);
        return;
      }
      resolve(JSON.parse(content) as T);
    });
  });
}

function realpath(p: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    fs.realpath(p, (err, resolvedPath) => {
      if (err) {
        resolve(null);
      }
      resolve(resolvedPath);
    });
  });
}

async function symlink(source: string, target: string) {
  if (fs.existsSync(target)) {
    const ifSymlink = fs.lstatSync(target).isSymbolicLink();
    if (!ifSymlink) {
      return false;
    }
    const real = await realpath(target);
    if (real === source) {
      return true;
    }
    await unlink(target);
  }
  return new Promise(resolve => {
    fs.symlink(source, target, err => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

async function writeYaml(
  locationPath: string,
  json: Record<string, any>
): Promise<string> {
  return writeFile(locationPath, jsyaml.dump(json));
}

async function writeJson(
  locationPath: string,
  json: Record<string, any>
): Promise<string> {
  return writeFile(locationPath, JSON.stringify(json));
}

async function createFileIntoDirIfNotExist(
  dirPath: string,
  filename: string,
  ends?: string[]
): Promise<void> {
  const [name] = filename.split('.');
  const allNotExist = (ends || []).every(
    end => !fs.existsSync(path.join(dirPath, `${name}.${end}`))
  );
  if (!fs.existsSync(path.join(dirPath, filename)) && allNotExist) {
    await createFile(path.join(dirPath, filename));
  }
}

async function copyFolder(
  sourceDirPath: string,
  targetDirPath: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.cp(
      sourceDirPath,
      targetDirPath,
      {
        recursive: true,
        force: false,
        filter(source: string): boolean | Promise<boolean> {
          return source !== 'node_modules';
        }
      },
      err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      }
    );
  });
}

export {
  readdir,
  mkdir,
  symlink,
  mkdirIfNotExist,
  readFile,
  writeFile,
  readJson,
  writeJson,
  createFile,
  createFileIfNotExist,
  createFileIntoDirIfNotExist,
  copyFolder,
  unlink,
  isFile,
  isDirectory,
  rmdir,
  rename
};

export const file = {
  readdir,
  mkdir,
  symlink,
  mkdirIfNotExist,
  readFile,
  writeFile,
  readJson,
  writeJson,
  readYaml,
  writeYaml,
  createFile,
  createFileIfNotExist,
  createFileIntoDirIfNotExist,
  copyFolder,
  unlink,
  isFile,
  isDirectory,
  isSymlink,
  isInvalidSymlink,
  rmdir,
  rename
};
