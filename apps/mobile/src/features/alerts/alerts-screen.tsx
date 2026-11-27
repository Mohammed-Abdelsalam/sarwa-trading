import {
  Activity,
  BellPlus,
  BellRing,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Trash2,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Alert, type Sector } from '@sarwa/contracts';
import { type BadgeTone } from '@sarwa/tokens';

import { Empty, Loading, LoadError } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/icon-button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { CreateAlertSheet } from './create-alert-sheet';
import { type AlertState, useAlertsScreen } from './use-alerts-screen';

const STATE_TONE: Record<AlertState, BadgeTone> = {
  active: 'pos',
  paused: 'neutral',
  triggered: 'brand',
};
const CONDITION_ICON = { price_above: ChevronUp, price_below: ChevronDown, move_today: Activity };

interface AlertRowModel {
  id: string;
  symbol: string;
  sector?: Sector;
  condition: Alert['condition'];
  enabled: boolean;
  rule: string;
  detail: string;
  repeat: string;
  state: AlertState;
}

function AlertRow({
  row,
  onToggle,
  onRemove,
}: {
  row: AlertRowModel;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const { t, m } = useCopy();
  const Icon = CONDITION_ICON[row.condition];
  const toggleLabel = row.enabled ? m.pause : m.resume;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${toggleLabel} ${row.symbol}`}
            onPress={onToggle}
            className="w-20 items-center justify-center gap-1 bg-surface-3"
          >
            {row.enabled ? (
              <Pause size={18} color={colors.fg} />
            ) : (
              <Play size={18} color={colors.fg} />
            )}
            <Text variant="caption" weight={600}>
              {toggleLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${m.delete} ${row.symbol}`}
            onPress={onRemove}
            className="w-20 items-center justify-center gap-1 bg-danger"
          >
            <Trash2 size={18} color={colors['on-brand']} />
            <Text variant="caption" weight={600} className="text-on-brand">
              {m.delete}
            </Text>
          </Pressable>
        </View>
      )}
    >
      <View
        accessible
        accessibilityLabel={[
          row.symbol,
          row.rule,
          row.detail,
          row.repeat,
          t.alerts.states[row.state],
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={[
          { name: 'toggle', label: toggleLabel },
          { name: 'delete', label: m.delete },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'toggle') onToggle();
          else onRemove();
        }}
        className="min-h-16 flex-row items-center gap-3 border-b border-border bg-bg px-4 py-3"
      >
        <StockAvatar symbol={row.symbol} sector={row.sector} />
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text variant="symbol">{row.symbol}</Text>
            <Icon size={16} color={colors['fg-3']} />
            <Text variant="sm" className="shrink" numberOfLines={1}>
              {row.rule}
            </Text>
          </View>
          <Text variant="caption" className="text-fg-3" numberOfLines={2}>
            {[row.detail, row.repeat].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Badge label={t.alerts.states[row.state]} tone={STATE_TONE[row.state]} />
      </View>
    </ReanimatedSwipeable>
  );
}

export function AlertsScreen({ symbol }: { symbol?: string }) {
  const { t } = useCopy();
  const screen = useAlertsScreen(symbol);
  const { actions } = screen;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar
        title={t.alerts.title}
        right={
          <View className="flex-row items-center gap-1">
            <Text variant="caption" className="text-fg-3">
              {screen.count}
            </Text>
            <IconButton
              label={t.alerts.newAlert}
              icon={BellPlus}
              size={44}
              onPress={actions.newAlert}
            />
          </View>
        }
      />
      {screen.isLoading ? (
        <Loading />
      ) : screen.isError ? (
        <LoadError onRetry={actions.retry} />
      ) : screen.rows.length === 0 ? (
        <Empty icon={BellRing} title={t.alerts.empty} />
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {screen.rows.map((row) => (
            <AlertRow
              key={row.id}
              row={row}
              onToggle={() => {
                actions.toggle(row.id, row.enabled);
              }}
              onRemove={() => {
                actions.remove(row.id);
              }}
            />
          ))}
        </ScrollView>
      )}
      <CreateAlertSheet symbol={screen.creating} onClose={actions.closeCreate} />
    </SafeAreaView>
  );
}
