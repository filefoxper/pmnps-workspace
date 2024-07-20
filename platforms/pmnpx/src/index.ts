#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import * as console from 'node:console';

const cwd = process.cwd();

const findPmnps = function findPmnps(
  pathname: string,
  times = 1
): string | null {
  if (!fs.existsSync(pathname) || times >= 16) {
    return null;
  }
  const detectPathname = path.join(
    pathname,
    'node_modules',
    'pmnps',
    'bin',
    'index.js'
  );
  const exist = fs.existsSync(detectPathname);
  if (exist) {
    return detectPathname;
  }
  return findPmnps(path.join(pathname, '..'), times + 1);
};

const founddPmnpsPathname = findPmnps(cwd);

const pmnpsLocation = path.join(__dirname, '..', '..', 'pmnps');

if (founddPmnpsPathname) {
  require(founddPmnpsPathname);
} else if (fs.existsSync(pmnpsLocation)) {
  require(pmnpsLocation);
} else {
  console.warn('Can not find pmnps dependent...');
}
