import { useState } from 'react';

import { type MeSummary } from '@sarwa/contracts';
import {
  type DELETE_CONFIRM,
  type RESET_CONFIRM,
  useDeleteAccount,
  useMeSummary,
  usePortfolio,
  useSelfReset,
  useSignOut,
} from '@sarwa/core';

import { type FieldError, fieldErrors } from '../auth/auth-view';

export type DangerDialog = 'none' | 'delete' | 'reset';

export interface DangerPageView {
  // GET /me/summary plus the open positions the reset dialog names.
  summary: (MeSummary & { positions: number }) | null;
  dialog: DangerDialog;
  isSigningOut: boolean;
  deletion: {
    password: string;
    confirm: string;
    errors: Partial<Record<'password' | 'confirm', FieldError>>;
    passwordIncorrect: boolean;
    isPending: boolean;
  };
  reset: { confirm: string; isPending: boolean };
  actions: {
    signOut: () => void;
    open: (dialog: Exclude<DangerDialog, 'none'>) => void;
    close: () => void;
    setDeletePassword: (value: string) => void;
    setDeleteConfirm: (value: string) => void;
    submitDelete: () => void;
    setResetConfirm: (value: string) => void;
    submitReset: () => void;
  };
}

export function useDangerPage(): DangerPageView {
  const signOut = useSignOut();
  const deletion = useDeleteAccount();
  const reset = useSelfReset();
  const summary = useMeSummary().data;
  const positions = usePortfolio().summary?.positions.length ?? 0;
  const [dialog, setDialog] = useState<DangerDialog>('none');
  const [deleteValues, setDeleteValues] = useState({ password: '', confirm: '' });
  const [resetConfirm, setResetConfirm] = useState('');

  const shown = (dialog === 'reset' && reset.isSuccess) || deletion.isSuccess ? 'none' : dialog;
  return {
    summary: summary ? { ...summary, positions } : null,
    dialog: shown,
    isSigningOut: signOut.isPending,
    deletion: {
      ...deleteValues,
      errors: fieldErrors(deletion.fieldErrors, ['password', 'confirm'] as const),
      passwordIncorrect:
        deletion.error === 'INVALID_CURRENT_PASSWORD' || deletion.error === 'INVALID_CREDENTIALS',
      isPending: deletion.isPending,
    },
    reset: { confirm: resetConfirm, isPending: reset.isPending },
    actions: {
      signOut: signOut.signOut,
      open: (next) => {
        deletion.reset();
        reset.reset();
        setDeleteValues({ password: '', confirm: '' });
        setResetConfirm('');
        setDialog(next);
      },
      close: () => {
        setDialog('none');
      },
      setDeletePassword: (password) => {
        setDeleteValues((current) => ({ ...current, password }));
      },
      setDeleteConfirm: (confirm) => {
        setDeleteValues((current) => ({ ...current, confirm }));
      },
      // The schema answers any other text with CONFIRMATION_MISMATCH.
      submitDelete: () => {
        deletion.submit({
          password: deleteValues.password,
          confirm: deleteValues.confirm as typeof DELETE_CONFIRM,
        });
      },
      setResetConfirm,
      submitReset: () => {
        reset.submit({ confirm: resetConfirm as typeof RESET_CONFIRM });
      },
    },
  };
}
