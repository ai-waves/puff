import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type Buzz = 'light' | 'medium' | 'success';

// Fire-and-forget; the browser build has no haptics and that's fine.
export function buzz(kind: Buzz): void {
  const call =
    kind === 'success'
      ? Haptics.notification({ type: NotificationType.Success })
      : Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
  call.catch(() => undefined);
}
