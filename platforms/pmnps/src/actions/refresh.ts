import { refreshProject } from '@/actions/task/refresh';
import type { ActionMessage } from '@/actions/task/type';

export async function refreshAction(): Promise<ActionMessage> {
  return refreshProject();
}
