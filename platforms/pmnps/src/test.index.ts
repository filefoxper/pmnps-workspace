process.env.NODE_ENV = 'development';

import { startup } from './main';

async function test_startup() {
  await startup(true);
}

test_startup();
