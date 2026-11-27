import { ChartArea, Gift, Globe, Info, Moon, User, UserPlus } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigState } from '../../components/layout/form-screen';
import { Loading } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { SettingsCard, SettingsRow } from '../../components/ui/settings-row';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { gateCopy } from './auth-gate-sheet';
import { type MemberStatus, useGuestCta } from './use-guest-cta';

export interface GuestCtaModel {
  onCreateAccount: () => void;
  onSignIn: () => void;
}

// The order ticket footer for a guest: the ticket stays explorable, submit becomes sign-up.
export interface GuestOrderFooterView extends GuestCtaModel {
  symbol: string;
  side: 'buy' | 'sell';
  startingCash: string;
}

export function GuestOrderFooter({ view }: { view: GuestOrderFooterView }) {
  const { t } = useCopy();
  const colors = useColors();
  const cta = view.side === 'buy' ? t.gate.ticket.buyCta : t.gate.ticket.sellCta;
  return (
    <View className="gap-2.5">
      <Callout tone="info" icon={Gift} body={t.gate.order.footer({ amount: view.startingCash })} />
      <Button
        size="lg"
        icon={<UserPlus size={16} color={colors['on-brand']} />}
        onPress={view.onCreateAccount}
      >
        {cta({ symbol: view.symbol })}
      </Button>
      <Pressable
        accessibilityRole="link"
        onPress={view.onSignIn}
        className="min-h-11 items-center justify-center"
      >
        <Text variant="sm" weight={600} className="text-brand-fg">
          {t.gate.ticket.haveAccount}
        </Text>
      </Pressable>
    </View>
  );
}

function GuestCtas({ cta, create }: { cta: GuestCtaModel; create: string }) {
  const { t } = useCopy();
  return (
    <View className="w-full gap-2.5 pt-2">
      <Button size="lg" onPress={cta.onCreateAccount}>
        {create}
      </Button>
      <Button size="lg" variant="secondary" onPress={cta.onSignIn}>
        {t.gate.cta.signIn}
      </Button>
    </View>
  );
}

// The Portfolio tab for a guest: an invitation, never an error.
export interface GuestPortfolioView extends GuestCtaModel {
  startingCash: string;
}

export function GuestPortfolio({ view }: { view: GuestPortfolioView }) {
  const { t } = useCopy();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="px-5 pb-3 pt-1">
        <Text variant="h1" accessibilityRole="header">
          {t.nav.portfolio}
        </Text>
      </View>
      <ScrollView contentContainerClassName="grow justify-center px-6 pb-10">
        <BigState
          icon={ChartArea}
          title={t.guest.portfolio.title({ amount: view.startingCash })}
          body={t.guest.portfolio.bodyMobile}
        >
          <GuestCtas cta={view} create={t.gate.cta.createFree} />
        </BigState>
      </ScrollView>
    </SafeAreaView>
  );
}

// Account tab for a guest: a welcome plus the app settings that work signed out.
export interface GuestAccountView extends GuestCtaModel {
  startingCash: string;
  // Current values, already in the app language ("English", "Follows system").
  language: string;
  theme: string;
  onLanguage: () => void;
  onTheme: () => void;
  onAbout: () => void;
}

export function GuestAccountScreen({ view }: { view: GuestAccountView }) {
  const { t } = useCopy();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-4">
        <BigState
          level="h1"
          icon={User}
          title={t.account.guest.title}
          body={t.account.guest.body({ amount: view.startingCash })}
        >
          <GuestCtas cta={view} create={t.auth.signUp.submit} />
        </BigState>
        <View className="gap-2">
          <Text variant="overline" accessibilityRole="header" className="text-fg-3">
            {t.account.guest.appSettings}
          </Text>
          <SettingsCard>
            <SettingsRow
              icon={Globe}
              title={t.settings.language}
              value={view.language}
              onPress={view.onLanguage}
            />
            <SettingsRow
              icon={Moon}
              title={t.settings.theme}
              value={view.theme}
              onPress={view.onTheme}
            />
            <SettingsRow icon={Info} title={t.account.guest.about} onPress={view.onAbout} />
          </SettingsCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Orders, alerts and notifications for a guest: the gate's own words on a full screen.
export function GuestFeatureScreen({ kind }: { kind: 'orders' | 'alert' | 'notifications' }) {
  const copy = useCopy();
  const cta = useGuestCta();
  const content = gateCopy({ kind }, cta.startingCash, copy);
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar />
      <ScrollView contentContainerClassName="grow justify-center px-6 pb-10">
        <BigState icon={content.icon} title={content.title} body={content.sub}>
          <GuestCtas cta={cta} create={copy.t.gate.cta.createFree} />
        </BigState>
      </ScrollView>
    </SafeAreaView>
  );
}

// Personal screens: a spinner while the session restores, the guest version for a guest.
export function MemberOnly({ guest, children }: { guest: ReactNode; children: ReactNode }) {
  const { status } = useGuestCta();
  const views: Record<MemberStatus, ReactNode> = {
    loading: (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Loading />
      </SafeAreaView>
    ),
    guest,
    member: children,
  };
  return views[status];
}

export function GuestPortfolioTab() {
  return <GuestPortfolio view={useGuestCta()} />;
}
