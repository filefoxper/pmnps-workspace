# @pmnps/plugin-publish

This is a plugin for [pmnps](https://github.com/pmnps/pmnps) to publish packages to npm registry.

From pmnps@4.0.0, command `pmnps publish` is removed. With this plugin, you can use this command again.

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-publish"
    ]
}
```

If you want to exclude the folders which you don't want to show in vscode workspace, use `query` config:

```
{
    ...,
    "plugins":[
        [
            "@pmnps/plugin-publish",
            {
                "registry":"https://registry.npmjs.org"
            }
        ]
    ]
}
```