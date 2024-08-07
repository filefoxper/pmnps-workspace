import { task } from '@/actions/task';
import { hold } from '@/state';
import { path, readFile, readJson, writeFile, writeJson } from '@/libs';

export const getPluginState = (required?: Promise<any>) => {
  return {
    getProject: () => {
      const project = hold.instance().getState().project;
      if (project == null) {
        throw new Error('Project should not be null.');
      }
      return project;
    },
    getConfig: () => {
      const config = hold.instance().getState().config;
      if (config == null) {
        throw new Error('Config should not be null.');
      }
      return config;
    },
    getLockState: () => {
      const dynamicState = hold.instance().getState().dynamicState;
      if (dynamicState == null) {
        throw new Error('Config should not be null.');
      }
      return dynamicState;
    },
    isCoreChanged: () => hold.instance().isCoreChanged(),
    task,
    cwd: () => path.cwd(),
    reader: {
      read: readFile,
      readJson: readJson
    },
    writer: {
      write: writeFile,
      writeJson: writeJson
    },
    required
  };
};

export const getPluginRequireState = () => {
  return {
    getProject: () => {
      const project = hold.instance().getState().project;
      if (project == null) {
        throw new Error('Project should not be null.');
      }
      return project;
    },
    getConfig: () => {
      const config = hold.instance().getState().config;
      if (config == null) {
        throw new Error('Config should not be null.');
      }
      return config;
    },
    getLockState: () => {
      const dynamicState = hold.instance().getState().dynamicState;
      if (dynamicState == null) {
        throw new Error('Config should not be null.');
      }
      return dynamicState;
    },
    cwd: () => path.cwd(),
    reader: {
      read: readFile,
      readJson: readJson
    },
    writer: {
      write: writeFile,
      writeJson: writeJson
    }
  };
};
