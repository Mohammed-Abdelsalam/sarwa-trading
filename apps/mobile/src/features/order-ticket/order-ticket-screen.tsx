import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Order } from '@sarwa/contracts';
import { type TicketForm } from '@sarwa/core';

import { TopBar } from '../../components/layout/top-bar';
import { MarketStatusPill } from '../../components/trading/market-status-pill';
import { useCopy } from '../../lib/i18n';
import { TicketEntry } from './ticket-entry';
import { TicketResult } from './ticket-result';
import { TicketReview } from './ticket-review';
import { useOrderTicketScreen } from './use-order-ticket-screen';

export function OrderTicketScreen({
  symbol,
  side,
  initialForm,
}: {
  symbol: string;
  side: Order['side'];
  initialForm?: TicketForm;
}) {
  const { t } = useCopy();
  const screen = useOrderTicketScreen(symbol, side, initialForm);
  const { step, header, actions } = screen;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      accessibilityLabel={t.ticket.a11yLabel}
      className="flex-1 bg-bg"
    >
      {step === 'entry' ? (
        <TopBar
          close
          title={header.title}
          onLeave={actions.close}
          right={
            <View className="me-2">
              <MarketStatusPill pill={header.pill} short />
            </View>
          }
        />
      ) : step === 'review' ? (
        <TopBar title={t.ticket.review} onLeave={actions.back} />
      ) : (
        <TopBar close onLeave={actions.close} />
      )}
      {step === 'entry' ? (
        <TicketEntry entry={screen.entry} guest={screen.guest} actions={actions} />
      ) : step === 'review' ? (
        <TicketReview
          symbol={symbol}
          sector={screen.sector}
          review={screen.review}
          actions={actions}
        />
      ) : screen.result ? (
        <TicketResult result={screen.result} actions={actions} />
      ) : null}
    </SafeAreaView>
  );
}
