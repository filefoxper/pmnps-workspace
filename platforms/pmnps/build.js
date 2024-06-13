const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints:['./src/index.ts'],
  bundle:true,
  external:['@pmnps/*','prettier','prettier-package-json'],
  outfile:'./bin/index.js',
  target:'node16',
  platform:'node',
  format:'cjs',
  logLevel:'info'
});
