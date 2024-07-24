# @pmnps/plugin-alias

This plugin can help you set an command alias in mac os.

## Usage

Config the `.pmnpsrc.json`:

```
{
    ...,
    "plugins":[
        "@pmnps/plugin-alias"
    ]
}
```
Use command `npx pmnps alias <alias>=<command>` to set an alias for a command.

```
$ npx pmnps alias px=pmnpx
```

After that, you can use `px` command to execute `pmnpx` command.

## Windows

If you are using windows system, you have to add alias manually.

Adding a permanent alias in Powershell (Windows):

```
notepad $profile.AllUsersAllHosts
```

In the profile.ps1 file that opens, put:

```
set-alias -name px -value pmnpx
```

Save the file and close the window. You may need to close any open Powershell window in order for the alias to take effect.