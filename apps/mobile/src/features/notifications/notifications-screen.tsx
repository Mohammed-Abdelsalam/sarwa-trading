import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  type LucideIcon,
  Megaphone,
  Pause,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ColorRole } from '@sarwa/tokens';

import { Empty, Loading, LoadError } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { type NotificationKind, type NotificationLine } from './notification-copy';
import { useNotificationsScreen } from './use-notifications-screen';

const ICON: Record<NotificationKind, [LucideIcon, ColorRole]> = {
  filled: [CheckCircle2, 'pos'],
  alert: [Bell, 'brand-fg'],
  rejected: [AlertTriangle, 'neg'],
  expired: [Clock, 'fg-3'],
  halted: [Pause, 'warn'],
  notice: [Megaphone, 'info'],
};

function NotificationRow({ line, onPress }: { line: NotificationLine; onPress: () => void }) {
  const colors = useColors();
  const { t } = useCopy();
  const [Icon, color] = ICON[line.kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        line.unread ? t.notifications.unread : null,
        line.title,
        line.body,
        line.when,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      className="flex-row items-start gap-3 border-b border-border px-4 py-3 active:bg-surface-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-control-lg bg-surface-3">
        <Icon size={18} color={colors[color]} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row justify-between gap-2">
          <Text variant="sm" weight={700} className="shrink">
            {line.title}
          </Text>
          <Text variant="caption" className="text-fg-3">
            {line.when}
          </Text>
        </View>
        <Text variant="sm" className="text-fg-2">
          {line.body}
        </Text>
      </View>
      <View className="w-2 pt-1.5">
        {line.unread ? (
          <View testID="unread-dot" className="h-2 w-2 rounded-full bg-brand" />
        ) : null}
      </View>
    </Pressable>
  );
}

export function NotificationsScreen() {
  const { t } = useCopy();
  const colors = useColors();
  const { groups, unreadCount, isLoading, isError, isLoadingMore, actions } =
    useNotificationsScreen();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar
        title={t.notifications.title}
        right={
          unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={actions.markAllRead}
              className="min-h-11 justify-center rounded-control-sm px-3 active:bg-surface-3"
            >
              <Text variant="sm" weight={600} className="text-brand-fg">
                {t.notifications.markAllRead}
              </Text>
            </Pressable>
          ) : null
        }
      />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={actions.retry} />
      ) : groups.length === 0 ? (
        <Empty icon={BellOff} title={t.notifications.empty} />
      ) : (
        <SectionList
          testID="notifications-list"
          sections={groups.map((group) => ({ ...group, data: group.items }))}
          keyExtractor={(line) => line.id}
          renderSectionHeader={({ section }) => (
            <Text
              variant="overline"
              accessibilityRole="header"
              className="bg-bg px-4 pb-1.5 pt-3.5 text-fg-3"
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <NotificationRow
              line={item}
              onPress={() => {
                actions.open(item);
              }}
            />
          )}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator className="py-4" color={colors['brand-fg']} />
            ) : undefined
          }
          onEndReached={actions.loadMore}
          onEndReachedThreshold={0.5}
          contentContainerClassName="pb-10"
        />
      )}
    </SafeAreaView>
  );
}
