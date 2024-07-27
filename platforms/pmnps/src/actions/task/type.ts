import type { PackageType } from '@pmnps/tools';

export type CommandFile =
  | 'install'
  | 'prettier'
  | 'prettier-package-json'
  | 'add';

export type CommandType = 'node' | 'npx' | 'npm' | 'git';

export type CommandSerial = string[];

export interface WriteTask {
  type: 'write';
  fileType: 'file' | 'dir';
  path: string;
  file: string;
  content: string | object | ((c: string | null) => string | null);
  cwd?: string;
  dirSource?: string;
  option?: {
    formatter?: (content: string) => Promise<string>;
    skipIfExist?: true;
    command?: CommandSerial[];
  };
}

export interface PackageTask extends WriteTask {
  packageType: PackageType;
  paths: string[] | null;
}

export interface ExecuteTask {
  type: 'exec';
  command: CommandSerial;
  cwd?: string;
  description?: string;
}

export interface Execution {
  command: CommandSerial;
  cwd?: string;
  description?: string;
}

export type Task = WriteTask | ExecuteTask | PackageTask;

export type ActionMessage<P = unknown> = {
  type: 'success' | 'failed' | 'warning';
  content: string;
  payload?: P;
  requireRefresh?: boolean;
  children?: ActionMessage<any>[];
};
