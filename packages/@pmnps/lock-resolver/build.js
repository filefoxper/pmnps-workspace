const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints:['./src/index.ts'],
  bundle:true,
  outfile:'./dist/index.js',
  external:['@pmnps/*'],
  target:'node16',
  platform:'node',
  format:'cjs',
  logLevel:'info'
});
