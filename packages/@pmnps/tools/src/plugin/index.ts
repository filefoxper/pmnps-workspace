import type { Action, Command, CommandOption, RequireFn } from './type';

export function createPluginCommand(name: string) {
  const command: {
    name: string;
    require: RequireFn | undefined;
    required: Promise<any> | undefined;
    pluginOptions: CommandOption[];
    action: Action | undefined;
    description: string;
  } = {
    name,
    require: undefined,
    required: undefined,
    pluginOptions: [],
    action: undefined,
    description: name
  };
  const pluginSlot = {
    name,
    option(
      optionName: string,
      shortcut: string,
      optional?: { description?: string; inputType?: 'string' | 'boolean' }
    ) {
      const { description = '', inputType = 'boolean' } = optional ?? {};
      command.pluginOptions.push({
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
