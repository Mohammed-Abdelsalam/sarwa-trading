'use client';

import { POLICY } from '@sarwa/core';
import { Dialog, SegmentedControl, StockAvatar } from '@sarwa/ui';

import { type Copy, useCopy } from '../../lib/i18n';
import { linkClass } from '../auth/auth-parts';
import { SignInForm } from '../auth/sign-in-page';
import { SignUpForm } from '../auth/sign-up-page';
import { type AuthGateView, type GateIntent, type GateTab, useAuthGate } from './use-auth-gate';

export function gateTitle({ t }: Copy, intent: GateIntent): string {
  const symbol = intent.symbol ?? intent.stock?.symbol ?? '';
  const titles = t.gate.title;
  if (intent.action === 'buy') return titles.buy({ symbol });
  if (intent.action === 'sell') return titles.sell({ symbol });
  return titles[intent.action];
}

// One modal for every gated action: focus starts on the contextual title, Esc returns to the trigger.
export function AuthGateDialog({ view }: { view: AuthGateView }) {
  const copy = useCopy();
  const { t, f, m } = copy;
  const { intent } = view;
  return (
    <Dialog
      open={intent !== null}
      onOpenChange={(open) => {
        if (!open) view.actions.close();
      }}
      title={intent ? gateTitle(copy, intent) : ''}
      description={t.gate.modal.sub({
        amount: f.money(POLICY.startingCashCents, { whole: true }),
      })}
      header={
        intent?.stock ? (
          <StockAvatar symbol={intent.stock.symbol} sector={intent.stock.sector} size={40} />
        ) : undefined
      }
      closeLabel={t.common.close}
      focusTitle
    >
      <SegmentedControl<GateTab>
        label={m.gate.modeA11y}
        value={view.tab}
        onChange={view.actions.setTab}
        className="w-full [&>button]:flex-1"
        options={[
          { value: 'signUp', label: t.gate.tabs.signUp },
          { value: 'signIn', label: t.gate.tabs.signIn },
        ]}
      />
      {view.tab === 'signUp' ? (
        <SignUpForm view={view.signUp} compact submitLabel={t.gate.modal.submit} />
      ) : (
        <>
          <SignInForm view={view.signIn} submitLabel={t.gate.modal.signInSubmit} />
          <p className="type-sm text-fg-2 text-center">
            {t.auth.signIn.newHere}{' '}
            <button
              type="button"
              className={`${linkClass} cursor-pointer`}
              onClick={() => {
                view.actions.setTab('signUp');
              }}
            >
              {t.auth.signIn.signUpLink}
            </button>
          </p>
        </>
      )}
      {intent?.amountCents !== undefined ? (
        <p className="type-caption text-fg-3 text-center">
          {t.gate.modal.returnNote({ amount: f.money(intent.amountCents) })}
        </p>
      ) : null}
    </Dialog>
  );
}

// Mounted once at the root: every gated action opens this one modal.
export function AuthGateHost() {
  return <AuthGateDialog view={useAuthGate()} />;
}
