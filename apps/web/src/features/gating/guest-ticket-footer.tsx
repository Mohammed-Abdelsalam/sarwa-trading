'use client';

import { POLICY } from '@sarwa/core';
import { Button, type OrderSide } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { linkClass } from '../auth/auth-parts';

// The guest order ticket stays explorable; only the submit becomes a sign-up.
export function GuestTicketFooter({
  side,
  symbol,
  onSignUp,
  onSignIn,
}: {
  side: OrderSide;
  symbol: string;
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  const { t, f } = useCopy();
  return (
    <div className="flex flex-col gap-3">
      <p className="type-sm text-fg-3">{t.gate.ticket.buyingPower}</p>
      <Button size="lg" className="w-full" onClick={onSignUp}>
        {side === 'buy' ? t.gate.ticket.buyCta({ symbol }) : t.gate.ticket.sellCta({ symbol })}
      </Button>
      <p className="type-sm text-fg-2 text-center">
        {t.auth.signUp.haveAccount}{' '}
        <button type="button" className={`${linkClass} cursor-pointer`} onClick={onSignIn}>
          {t.auth.signUp.signInLink}
        </button>
      </p>
      <p className="type-caption text-fg-3 text-center">
        {t.gate.ticket.foot({ amount: f.money(POLICY.startingCashCents, { whole: true }) })}
      </p>
    </div>
  );
}
