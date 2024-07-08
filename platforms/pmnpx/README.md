[![npm][npm-image]][npm-url]
[![NPM downloads][npm-downloads-image]][npm-url]
[![standard][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/pmnpx.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/pmnpx
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard
[npm-downloads-image]: https://img.shields.io/npm/dm/pmnpx.svg?style=flat-square

# pmnpx

`pmnpx` is a startup package for monorepo tool [pmnps](https://www.npmjs.com/package/pmnps)

## Install

Install this package in global can help you using pmnps more easier.

```
npm install pmnpx -g
```

## Useage

Start it in any dir. It always find a nearest pmnps package to this dir.

```
- <system global>
  - node_modules
    - pmnps
    - pmnpx
- homedir
  - workspace
    - project1
      - node_modules
        - pmnps
      - packages
      - platforms
        - platA
          - package.json
      - package.json
    - project2
      - package.json
```

For example:

Normal usage.

```
// dir homedir/workspace/project1
$ pmnpx start
// use pmnps in homedir/workspace/project1/node_modules/pmnps
```

Deep usage

```
// dir homedir/workspace/project1/platforms/platA
$ pmnpx start
// use pmnps in homedir/workspace/project1/node_modules/pmnps
```

None usage

```
// dir homedir/workspace/project2
$ pmnpx start
// use pmnps in <system global>/node_modules/pmnps
```

The command detail is same with pmnps command.
