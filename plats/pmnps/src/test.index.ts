process.env.NODE_ENV = 'development';

import {file,path} from "@pmnps/core";

const { startup } = require('./main');

async function test_startup(){
    await file.mkdirIfNotExist(path.rootPath);
    await startup();
}

test_startup();

