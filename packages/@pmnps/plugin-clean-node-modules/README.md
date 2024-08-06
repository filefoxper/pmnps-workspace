# @pmnps/plugin-clean-node-modules

The monorepo manage tool [pmnps](https://www.npmjs.com/package/pmnps) watches changes of `package.json` files for building a useful monorepo package workspaces. This plugin helps it to clean `node_modules` folders in project, when the pkg manager field `core` is changed. 

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-clean-node-modules"
    ]
}
```
