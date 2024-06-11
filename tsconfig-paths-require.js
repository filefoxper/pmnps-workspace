const tsconfigPaths = require('tsconfig-paths');

const tsconfig = require('./tsconfig.json');

tsconfigPaths.register({
  baseUrl: tsconfig.compilerOptions.baseUrl,
  paths: tsconfig.compilerOptions.paths
})