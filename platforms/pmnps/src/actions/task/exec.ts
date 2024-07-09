import { execution, message, path } from '@/libs';
import { groupBy, partition } from '@/libs/polyfill';
import { hold } from '@/state';
import type { Execution } from './type';

async function consumeAndInstall(install: Execution[], cwd: string) {
  if (!install.length) {
    return;
  }
  const [current, ...next] = install;
  const { command } = current;
  const [commandFile, ...params] = command;
  if (current.description) {
    message.log(`====== ${current.description} ======`);
  } else {
    message.log(`execute: ${command.join(' ')}`);
  }
  await execution.exec(commandFile, params, {
    stdio: 'inherit',
    cwd: current.cwd ?? cwd
  });
  if (!next.length) {
    return;
  }
  await consumeAndInstall(next, cwd);
}

export async function executeSystemOrders(orders: Execution[]) {
  const cwd = path.cwd();
  const { config } = hold.instance().getState();
  const [install, others] = partition(orders, o => {
    const k = o.command.join('_');
    return (
      k.startsWith('npm_install') ||
      k.startsWith('yarn_install') ||
      k.startsWith('pnpm_install')
    );
  });
  const cwds = new Map(
    install.map(i => {
      const { cwd: icwd, command } = i;
      return [
        [...command, icwd].filter((d): d is string => !!d).join(),
        i
      ] as const;
    })
  );
  if (config?.usePerformanceFirst) {
    await Promise.all(
      [...cwds].map(async p => {
        const [, e] = p;
        const [commandFile, ...params] = e.command;
        const subprocess = execution.exec(commandFile, params, {
          cwd: e.cwd ?? cwd
        });
        subprocess.stderr?.pipe(process.stderr);
        return subprocess;
      })
    );
  } else {
    await consumeAndInstall([...cwds.values()], cwd);
  }

  const groups = groupBy(
    others,
    o => `${o.command.slice(0, 2).join('_')}<-split->${o.cwd ?? cwd}`
  );
  return Promise.all(
    [...groups].map(async ([, os]) => {
      const [primary] = os;
      const { cwd: cwdIn } = primary;
      const paramSet = new Set(os.flatMap(o => o.command));
      const commands = [...paramSet];
      message.log(`execute: ${commands.join(' ')}`);
      const [command, ...params] = commands;
      if (!params.length) {
        return execution.exec(command, {
          stdio: 'inherit',
          cwd: cwdIn || cwd
        });
      }
      return execution.exec(command, params, {
        stdio: 'inherit',
        cwd: cwdIn || cwd
      });
    })
  );
}
