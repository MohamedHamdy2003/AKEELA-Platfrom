import { DetailWorkspace as SharedDetailWorkspace } from '@akeela/portal/detail-workspace';
import type { ComponentProps } from 'react';

export function DetailWorkspace(
  props: ComponentProps<typeof SharedDetailWorkspace>,
) {
  return <SharedDetailWorkspace {...props} eyebrow="إدارة المنصة" />;
}
