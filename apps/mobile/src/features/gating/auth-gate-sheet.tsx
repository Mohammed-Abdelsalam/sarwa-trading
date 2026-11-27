import * as Haptics from 'expo-haptics';
import {
  Bell,
  CheckCircle2,
  ChartArea,
  ListChecks,
  type LucideIcon,
  UserPlus,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { StateArt } from '../../components/layout/form-screen';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { type Copy, useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

// What the guest tried to do; amounts arrive formatted ("$500").
export type GateIntent =
  | { kind: 'buy' | 'sell'; symbol: string; amount?: string }
  | { kind: 'alert'; symbol?: string }
  | { kind: 'portfolio' | 'orders' | 'notifications' };

export interface AuthGateView {
  intent: GateIntent | null;
  startingCash: string;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onClose: () => void;
}

const SIGNUP_SECONDS = 30;

export function gateCopy(
  intent: GateIntent,
  startingCash: string,
  { t, f }: Copy,
): { icon: LucideIcon; title: string; sub: string; benefits: string[] } {
  switch (intent.kind) {
    case 'buy':
    case 'sell':
      return {
        icon: UserPlus,
        title: t.gate.title[intent.kind]({ symbol: intent.symbol }),
        sub: t.gate.sheet.buySub({ n: f.number(SIGNUP_SECONDS) }),
        benefits: [
          t.gate.sheet.benefitCash({ amount: startingCash }),
          t.gate.sheet.benefitSync,
          ...(intent.amount
            ? [t.gate.sheet.benefitOrder({ amount: intent.amount, symbol: intent.symbol })]
            : []),
        ],
      };
    case 'alert':
      return {
        icon: Bell,
        title: t.gate.title.alert,
        sub: intent.symbol
          ? t.gate.sheet.alertSub({ symbol: intent.symbol })
          : t.guest.empty.alertsBodyAny,
        benefits: [],
      };
    case 'portfolio':
      return {
        icon: ChartArea,
        title: t.gate.title.portfolio,
        sub: t.guest.portfolio.bodyMobile,
        benefits: [],
      };
    case 'orders':
      return {
        icon: ListChecks,
        title: t.gate.title.orders,
        sub: t.guest.empty.ordersBody,
        benefits: [],
      };
    case 'notifications':
      return {
        icon: Bell,
        title: t.gate.title.notifications,
        sub: t.guest.bell.body,
        benefits: [],
      };
  }
}

// One root sheet for every gated action; a light haptic marks it presenting.
export function AuthGateSheet({ view }: { view: AuthGateView }) {
  const copy = useCopy();
  const colors = useColors();
  const { t } = copy;
  const { intent } = view;
  const open = intent !== null;

  useEffect(() => {
    if (open) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [open]);

  const content = intent ? gateCopy(intent, view.startingCash, copy) : null;
  return (
    <Sheet visible={open} onClose={view.onClose}>
      {content ? (
        <>
          <StateArt icon={content.icon} />
          <View className="gap-1">
            <Text variant="h2" accessibilityRole="header">
              {content.title}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {content.sub}
            </Text>
          </View>
          {content.benefits.length > 0 ? (
            <View className="gap-2">
              {content.benefits.map((benefit) => (
                <View key={benefit} className="flex-row items-center gap-2">
                  <CheckCircle2 size={16} color={colors.pos} />
                  <Text variant="sm" className="flex-1">
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button size="lg" onPress={view.onCreateAccount}>
            {t.gate.cta.createFree}
          </Button>
          <Button size="lg" variant="secondary" onPress={view.onSignIn}>
            {t.gate.cta.signIn}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}
