import { refreshProject } from '@/actions/task/refresh';
import type { ActionMessage } from '@/actions/task/type';

export async function refreshAction(option?: {
  force?: boolean;
  install?: string;
  parameters?: string;
  name?: string;
}): Promise<ActionMessage> {
  return refreshProject(option);
}
