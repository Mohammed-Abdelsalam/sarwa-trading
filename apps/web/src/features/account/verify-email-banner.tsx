'use client';

import { MailWarning } from 'lucide-react';

import { Banner, Button } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { useVerifyBanner, type VerifyBannerView } from './use-verify-banner';

// Under the top bar until the email is verified; verification never blocks trading.
export function VerifyEmailBanner({ view }: { view: VerifyBannerView }) {
  const { t } = useCopy();
  if (!view.email) return null;
  return (
    <Banner
      bar
      tone="warn"
      icon={<MailWarning aria-hidden />}
      onDismiss={view.actions.dismiss}
      dismissLabel={t.verifyBanner.dismissA11y}
      action={
        <Button
          variant="ghost"
          size="sm"
          loading={view.resend === 'pending'}
          disabled={view.resend === 'sent'}
          onClick={view.actions.resend}
        >
          {view.resend === 'sent' ? t.verifyBanner.sent : t.verifyBanner.resend}
        </Button>
      }
    >
      {t.verifyBanner.body({ email: view.email })}
    </Banner>
  );
}

export function VerifyEmailBannerHost() {
  return <VerifyEmailBanner view={useVerifyBanner()} />;
}
