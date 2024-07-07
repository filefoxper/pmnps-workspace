#!/usr/bin/env node

import path from 'path';
import fs from 'fs';

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
  if (fs.existsSync(path.join(pathname, '.pmnpsrc.json'))) {
    return null;
  }
  return findPmnps(path.join(pathname, '..'), times + 1);
};

const founddPmnpsPathname = findPmnps(cwd);

if (founddPmnpsPathname) {
  require(founddPmnpsPathname);
} else {
  require('pmnps');
}
