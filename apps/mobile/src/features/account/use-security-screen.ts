import { router } from 'expo-router';
import { useState } from 'react';

import { useNow, useRevokeSession, useSession, useSessions, useSignOutOthers } from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { type SecurityView } from './security-screen';

const DAY_MS = 86_400_000;

export function passwordAge(changedAt: number | null, now: number, { t, f }: Copy): string {
  if (changedAt === null) return t.account.password.neverChanged;
  const days = Math.floor((now - changedAt) / DAY_MS);
  return days < 1 ? t.account.password.changedToday : t.account.password.lastChanged(f.count(days));
}

export function useSecurityScreen(): SecurityView {
  const copy = useCopy();
  const { t, f } = copy;
  const now = useNow();
  const { user } = useSession();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const signOutOthers = useSignOutOthers();
  const [confirming, setConfirming] = useState(false);
  const all = sessions.current ? [sessions.current, ...sessions.others] : sessions.others;
  const others = sessions.others;
  const othersCount = t.counts.devices(f.count(others.length));

  return {
    passwordChanged: passwordAge(user?.passwordChangedAt ?? null, now, copy),
    sessions: sessions.isLoading
      ? null
      : all.map((session) => ({
          id: session.id,
          label: session.label,
          platform: session.platform,
          meta: t.account.sessions.meta({
            ip: session.ipMasked,
            time: f.relative(session.lastActiveAt, now),
          }),
          current: session.current,
          signingOut: revoke.isPending && revoke.variables === session.id,
        })),
    sessionsError: sessions.isError,
    devices: t.counts.devices(f.count(all.length)),
    confirmSignOutOthers: confirming
      ? {
          sessions: t.counts.sessions(f.count(others.length)),
          devices: others.map((session) => session.label).join(', '),
          deviceCount: othersCount,
          confirming: signOutOthers.isPending,
          onConfirm: () => {
            signOutOthers.mutate(undefined, {
              onSuccess: ({ revoked }) => {
                setConfirming(false);
                showToast(
                  t.toasts.otherDevicesSignedOut({ sessions: t.counts.sessions(f.count(revoked)) }),
                );
              },
            });
          },
          onCancel: () => {
            setConfirming(false);
          },
        }
      : undefined,
    onChangePassword: () => {
      router.push('/account/change-password');
    },
    onSignOutSession: (id) => {
      const label = others.find((session) => session.id === id)?.label ?? '';
      revoke.mutate(id, {
        onSuccess: () => {
          showToast(t.toasts.sessionSignedOut({ device: label }));
        },
      });
    },
    onSignOutOthers: () => {
      setConfirming(true);
    },
    onRetry: sessions.retry,
    onBack: goBack,
  };
}
