'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

export const TOAST_MS = 5_000;
const MAX_TOASTS = 3;

// A toast renders itself and is handed its own dismiss.
export type ToastRender = (dismiss: () => void) => ReactNode;

const ToastContext = createContext<(render: ToastRender) => void>(() => undefined);

export function useToast(): (render: ToastRender) => void {
  return useContext(ToastContext);
}

function Timed({ onDone, children }: { onDone: () => void; children: ReactNode }) {
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const timer = setTimeout(done, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return children;
}

// Bottom-end stack; each toast leaves on its own after five seconds or when dismissed.
export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; render: ToastRender }[]>([]);
  const nextId = useRef(0);
  const [show] = useState(() => (render: ToastRender) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list.slice(1 - MAX_TOASTS), { id, render }]);
  });
  const dismiss = (id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:end-6 sm:items-end">
        {toasts.map((toast) => {
          const close = () => {
            dismiss(toast.id);
          };
          return (
            <Timed key={toast.id} onDone={close}>
              <div className="pointer-events-auto max-w-full">{toast.render(close)}</div>
            </Timed>
          );
        })}
      </div>
    </ToastContext>
  );
}
