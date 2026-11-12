import React from 'react';
import { GlassToast } from '@/src/components/ui/GlassToast';
import { useToastStore } from '@/src/store/toast-store';

/** Renders at app root so toasts survive screen navigation. */
export function AppToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);

  return (
    <GlassToast
      key={toast?.id ?? 'empty'}
      visible={!!toast}
      title={toast?.title || ''}
      message={toast?.message}
      tone={toast?.tone || 'success'}
      durationMs={toast?.durationMs ?? 2500}
      onHide={hide}
    />
  );
}
