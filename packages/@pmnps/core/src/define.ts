function platformDirName() {
  if (
    global.pmnps &&
    global.pmnps.config &&
    global.pmnps.config.useOldDefineName
  ) {
    return 'plats';
  }
  return 'platforms';
}

const PACKAGE_DIR_NAME = 'packages';

const PLATFORM_DIR_NAME = platformDirName();

const CONFIG_FILE_NAME = '.pmnpsrc.json';

const README_FILE_NAME = 'README.md';

const PRETTIER_RC_FILE_NAME = '.prettierrc.json';

const GIT_IGNORE_FILE_NAME = '.gitignore';

const NPM_RC_FILE_NAME = '.npmrc';

export {
  PACKAGE_DIR_NAME,
  PLATFORM_DIR_NAME,
  CONFIG_FILE_NAME,
  README_FILE_NAME,
  PRETTIER_RC_FILE_NAME,
  GIT_IGNORE_FILE_NAME,
  NPM_RC_FILE_NAME,
};

export default {
  PACKAGE_DIR_NAME,
  PLATFORM_DIR_NAME,
  CONFIG_FILE_NAME,
  README_FILE_NAME,
  PRETTIER_RC_FILE_NAME,
  GIT_IGNORE_FILE_NAME,
  NPM_RC_FILE_NAME
};
