import process from 'process';
import child_process from 'child_process';
import { version, message, path } from '@/libs';
import { hold } from '@/state';
import { configure } from '@/support';
import type { State } from '@/types';

function checkRuntimeEnv(): string | null {
  const nodeVersion = process.version;
  const nodeV = nodeVersion.startsWith('v')
    ? nodeVersion.slice(1)
    : nodeVersion;
  if (version.compare(nodeV, '16.7.0').lt()) {
    message.error('Pmnps needs nodejs version >= 16.7.0');
    return null;
  }
  return `Env: node@${nodeV}`;
}

export function loadProject(withCache?: boolean) {
  const cwd = path.cwd();
  const resolver = {
    resolve: (s: Partial<State>) => {
      // noop
    },
    reject: (e: unknown) => {
      // noop
    }
  };
  const loadPromise = new Promise<Partial<State>>((resolve, reject) => {
    resolver.resolve = (s: Partial<State>) => {
      resolve(s);
    };
    resolver.reject = reject as any;
  });
  const loadProcess = child_process.fork(
    path.join(__dirname, 'loadProcessor'),
    [cwd, withCache ? 'true' : 'false'],
    {
      stdio: 'inherit'
    }
  );
  loadProcess.once('message', (s: Partial<State>) => {
    resolver.resolve(s);
  });
  return loadPromise;
}

async function load() {
  const holder = hold.instance();
  const [config, partState] = await Promise.all([
    configure.readConfig(path.cwd()),
    holder.load(true)
  ]);
  holder.setState({ ...partState, config });
}

export async function initialize() {
  message.info('Pmnps startup...');
  const versions = checkRuntimeEnv();
  if (!versions) {
    return false;
  }
  message.desc(versions);
  await load();
  return true;
}
