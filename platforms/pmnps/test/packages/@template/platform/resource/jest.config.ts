import type {Config} from '@jest/types';

const config:Config.InitialOptions= {
  maxWorkers: 5,
  maxConcurrency:5,
  testMatch: ['<rootDir>/test/**/*.test.ts','<rootDir>/test/**/*.test.tsx'],
  rootDir: '',
  transform:{
    '\\.(t|j)sx?$':'<rootDir>/test/__config__/babel.test.config.js'
  },
  timers:"fake",
  moduleFileExtensions: ['js', 'ts', 'tsx'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'identity-obj-proxy',
    '\\.(css|less)$': 'identity-obj-proxy',
    '@/(.*)': '<rootDir>/src/$1',
    '@test/(.*)': '<rootDir>/test/$1',
  },
  bail:1,
  noStackTrace:true,
  collectCoverage:false,
  coverageDirectory:'<rootDir>/test/coverage',
  setupFilesAfterEnv:[
    '<rootDir>/test/__setup__/global.error.ts',
    '<rootDir>/test/__setup__/request.ts',
    '<rootDir>/test/__setup__/interactive.ts'
  ]
};

export default config;
