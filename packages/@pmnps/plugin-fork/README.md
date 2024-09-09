# @pmnps/plugin-fork

This is a plugin package for [pmnps](https://github.com/pmnps/pmnps). It can fork a node_modules package to workspace, so you can replace it easily.

## Config

```
// .pmnpsrc
{
  ...
  "plugins": [
    "@pmnps/plugin-fork",
    ......
  ],
}
```

## Usage

```
# npx pmnps fork node_modules/{{packageName}}
# npx pmnps fork platforms/{{platformName}}/node_modules/{{packageName}}
```

Note: the path you provide to fork command should be exist in node_modules.