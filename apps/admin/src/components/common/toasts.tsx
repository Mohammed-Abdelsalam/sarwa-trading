'use client';

import { CircleCheck } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { Toast } from '@sarwa/ui';

const TOAST_MS = 5_000;

// Screens rendered outside the shell (tests, the invite page) get a no-op.
const ToastContext = createContext<(title: string) => void>(() => undefined);

export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; title: string } | null>(null);
  const show = useCallback((title: string) => {
    setToast((last) => ({ id: (last?.id ?? 0) + 1, title }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed end-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] [&>*]:pointer-events-auto">
        {toast ? (
          <Toast
            key={toast.id}
            icon={<CircleCheck aria-hidden className="text-pos" />}
            title={toast.title}
          />
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
