import { Clock, Lock, Pause, WifiOff } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { type Order } from '@sarwa/contracts';

import { Keypad } from '../../components/trading/keypad';
import { SideSegment } from '../../components/trading/side-segment';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Chip } from '../../components/ui/chip';
import { KeyValueRow } from '../../components/ui/key-value-row';
import { Segmented } from '../../components/ui/segmented';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { AmountDisplay, KeypadField } from './amount-display';
import { type useOrderTicketScreen } from './use-order-ticket-screen';

type Screen = ReturnType<typeof useOrderTicketScreen>;

const GATE_ICON = { pause: Pause, clock: Clock, wifi: WifiOff };
const TYPES: Order['type'][] = ['market', 'limit', 'stop'];

export function TicketEntry({ entry, actions }: Pick<Screen, 'entry' | 'actions'>) {
  const colors = useColors();
  const { t } = useCopy();
  const { button } = entry;

  return (
    <>
      <ScrollView
        contentContainerClassName="gap-3 px-5 pb-3 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <SideSegment
          label={t.ticket.sideLabel}
          value={entry.side}
          onChange={actions.setSide}
          buyLabel={entry.buyLabel}
          sellLabel={entry.sellLabel}
        />
        {entry.quote ? (
          <View className="flex-row flex-wrap justify-between gap-x-2">
            <Text variant="caption" className="text-fg-2" style={{ fontVariant: ['tabular-nums'] }}>
              {entry.quote.bid}
            </Text>
            <Text variant="caption" className="text-fg-2" style={{ fontVariant: ['tabular-nums'] }}>
              {entry.quote.ask}
            </Text>
            <Text variant="caption" className="text-fg-3" style={{ fontVariant: ['tabular-nums'] }}>
              {entry.quote.spread}
            </Text>
          </View>
        ) : null}
        {entry.gates.map((gate) => (
          <Callout
            key={gate.key}
            tone={gate.tone}
            icon={GATE_ICON[gate.icon]}
            title={gate.title}
            body={gate.body}
          />
        ))}
        <View className="flex-row flex-wrap items-center gap-2">
          {TYPES.map((type) => (
            <Chip
              key={type}
              label={t.ticket.types[type]}
              selected={entry.type === type}
              onPress={() => {
                actions.setType(type);
              }}
            />
          ))}
          <View className="flex-1" />
          <Segmented
            size="sm"
            label={t.ticket.quantity}
            value={entry.sizeMode}
            onChange={actions.setSizeMode}
            options={[
              { value: 'amount', label: t.ticket.amount },
              { value: 'shares', label: t.ticket.shares },
            ]}
          />
        </View>
        {entry.showTif ? (
          <View className="flex-row items-center justify-between">
            <Text variant="sm" className="text-fg-2">
              {t.ticket.timeInForce}
            </Text>
            <Segmented
              size="sm"
              label={t.ticket.timeInForce}
              value={entry.tif}
              onChange={actions.setTif}
              options={[
                { value: 'day', label: t.ticket.tif.day },
                { value: 'gtc', label: t.ticket.tif.gtc },
              ]}
            />
          </View>
        ) : null}
        {entry.price ? (
          <KeypadField
            label={entry.price.label}
            value={entry.price.value}
            focused={entry.price.focused}
            error={entry.price.error}
            hint={entry.price.hint}
            onPress={actions.focusPrice}
          />
        ) : null}
        <AmountDisplay
          {...entry.amount}
          label={t.ticket.quantity}
          focused={entry.sizeFocused}
          error={entry.sizeError}
          onPress={actions.focusSize}
        />
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-center gap-2">
          {entry.chips.map((chip) => (
            <Chip
              key={chip.key}
              compact
              label={chip.label}
              selected={chip.selected}
              onPress={() => {
                actions.chooseQuickAmount(chip.amount);
              }}
            />
          ))}
        </View>
        <View>
          {entry.rows.map((row) => (
            <KeyValueRow key={row.key} label={row.label} value={row.value} />
          ))}
        </View>
        {entry.bufferNote ? (
          <Text variant="caption" className="text-fg-3">
            {entry.bufferNote}
          </Text>
        ) : null}
      </ScrollView>
      <View className="px-4">
        <Keypad onKey={actions.key} />
      </View>
      <View className="px-4 pb-2 pt-2.5">
        <Button
          size="lg"
          variant={button.blocked ? 'secondary' : 'primary'}
          disabled={button.disabled}
          icon={
            button.blocked ? (
              <Lock size={16} color={colors.fg} />
            ) : button.queued ? (
              <Clock size={16} color={colors['on-brand']} />
            ) : undefined
          }
          onPress={actions.review}
        >
          {button.label}
        </Button>
      </View>
    </>
  );
}
