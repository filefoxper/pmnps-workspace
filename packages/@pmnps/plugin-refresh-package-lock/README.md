# @pmnps/plugin-refresh-package-lock

The monorepo manage tool [pmnps](https://www.npmjs.com/package/pmnps) watches changes of `package.json` files for building a useful monorepo package workspaces. It handles the `lock` file process out to plugins. This pmnps plugin can refresh `package-lock.json` files when `pmnps refresh` is running. 

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-refresh-package-lock"
    ]
}
```

It refreshes `package-lock.json` file by using `lockfileVersion: 2`, If you are using another `lockfileVersion`, use `query` config to point it out:

```
{
    ...,
    "plugins":[
        [
            "@pmnps/plugin-refresh-package-lock",
            {
                "lockfileVersion": 2
            }
        ]
    ]
}
```

**Note: This plugin supports `lockfileVersion>=2`, so it can not refresh  package-lock.json file with `lockfileVersion: 1` currently.**
