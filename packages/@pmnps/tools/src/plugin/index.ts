import type { Action, Command, CommandOption, RequireFn } from './type';

export function createPluginCommand(name: string) {
  const command: {
    name: string;
    requireRefresh?: boolean;
    require: RequireFn | undefined;
    required: Promise<any> | undefined;
    options: CommandOption[];
    action: Action | undefined;
    description: string;
    list?: boolean;
    args?: { param: string; description: string };
  } = {
    name,
    requireRefresh: false,
    require: undefined,
    required: undefined,
    options: [],
    action: undefined,
    description: name,
    args: undefined
  };
  const pluginSlot = {
    name,
    list(l: boolean) {
      command.list = l;
      return pluginSlot;
    },
    args(param: string, description: string) {
      command.args = { param, description };
      return pluginSlot;
    },
    requireRefresh() {
      command.requireRefresh = true;
      return pluginSlot;
    },
    option(
      optionName: string,
      shortcut: string,
      optional?: { description?: string; inputType?: string }
    ) {
      const { description = '', inputType } = optional ?? {};
      command.options.push({
        name: optionName,
        shortcut,
        description,
        inputType
      });
      return pluginSlot;
    },
    require(requireFn: RequireFn) {
      command.require = function req(state, option) {
        const required = requireFn(state, option);
        command.required = required;
        return required;
      };
      return pluginSlot;
    },
    describe(description: string) {
      command.description = description;
      return pluginSlot;
    },
    action(action: Action): Command {
      command.action = action;
      return command as Command;
    }
  };
  return pluginSlot;
}
