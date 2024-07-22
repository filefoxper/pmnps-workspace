# @pmnps/plugin-vscode-workspace

You might be troubled by the problem about `can not find tsconfig` in projects, when using [pmnps](https://www.npmjs.com/package/pmnps). 
This plugin will run in refresh command, it creates a `.code-workspace` file, so, we can use [pmnps](https://www.npmjs.com/package/pmnps) more better in vscode, and resolve the `can not find tsconfig` problem.

If you are not familiy with `vscode multi workspace`, please take this [reference](https://code.visualstudio.com/docs/editor/multi-root-workspaces).

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-vscode-workspace"
    ]
}
```

If you want to exclude the folders which you don't want to show in vscode workspace, use `query` config:

```
{
    ...,
    "plugins":[
        [
            "@pmnps/plugin-vscode-workspace",
            {
                "excludes":["root","packages/@template"]
            }
        ]
    ]
}
```