import { create } from 'zustand';
import type { ComponentProps } from 'react';
import type { GlassToast } from '@/src/components/ui/GlassToast';

type ToastTone = NonNullable<ComponentProps<typeof GlassToast>['tone']>;

type ToastPayload = {
  id: number;
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastState = {
  toast: ToastPayload | null;
  show: (payload: Omit<ToastPayload, 'id'>) => void;
  hide: () => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (payload) => {
    seq += 1;
    set({
      toast: {
        id: seq,
        durationMs: 2500,
        tone: 'success',
        ...payload,
      },
    });
  },
  hide: () => set({ toast: null }),
}));
