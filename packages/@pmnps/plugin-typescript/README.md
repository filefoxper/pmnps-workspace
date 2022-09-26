# @pmnps/plugin-typescript

This plugin works in the [pmnps](https://www.npmjs.com/package/pmnps) command: 'create', it requires the version of typescript, and it is a optional plugin. It can complete the typescript setting for your creating package or platform.

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-typescript"
    ]
}
```

If you want to link `package.json > typings` property to `./src/index.ts`, use `query` config:

```
{
    ...,
    "plugins":[
        [
            "@pmnps/plugin-typescript",
            {
                "noDefineTypings":true
            }
        ]
    ]
}
```

It can help you import local package dependencies without `.d.ts` declare file when the `index.ts` of package is in a `package.src` dir.