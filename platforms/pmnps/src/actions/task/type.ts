import type { LockResolver, PackageType } from '@pmnps/tools';

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
  filter?: (filename: string) => boolean;
  force?: boolean;
  option?: {
    formatter?: (content: string) => Promise<string>;
    skipIfExist?: true;
    command?: CommandSerial[];
    onFinish?: () => Promise<any>;
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

export interface RemoveTask {
  type: 'remove';
  fileType?: 'file' | 'dir';
  cwd?: string;
  path: string;
}

export interface Execution {
  command: CommandSerial;
  cwd?: string;
  description?: string;
}

export type Task = WriteTask | ExecuteTask | PackageTask | RemoveTask;

export type ActionMessage<P = unknown> = {
  type: 'success' | 'failed' | 'warning';
  content: string;
  payload?: P;
  requireRefresh?: boolean | LockResolver;
  children?: ActionMessage<any>[];
};
