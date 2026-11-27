import { type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ColorRole } from '@sarwa/tokens';

import { cx, useColors } from '../../lib/theme';
import { Text } from '../ui/text';

// Full-screen forms: the body scrolls and the footer stays pinned above the keyboard.
export function FormScreen({
  header,
  children,
  footer,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        {header}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow gap-3.5 px-5 pb-6"
        >
          {children}
        </ScrollView>
        {footer ? <View className="gap-2.5 bg-bg px-5 pb-2 pt-3">{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-1.5 pb-1 pt-2">
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text className="text-fg-2">{subtitle}</Text> : null}
    </View>
  );
}

export type ArtTone = 'brand' | 'pos' | 'neg' | 'warn';

const ART: Record<ArtTone, [container: string, icon: ColorRole]> = {
  brand: ['bg-brand-subtle', 'brand-fg'],
  pos: ['bg-pos-subtle', 'pos'],
  neg: ['bg-neg-subtle', 'neg'],
  warn: ['bg-warn-subtle', 'warn'],
};

export function StateArt({ icon: Icon, tone = 'brand' }: { icon: LucideIcon; tone?: ArtTone }) {
  const colors = useColors();
  const [container, icon] = ART[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cx('h-art w-art items-center justify-center rounded-art', container)}
    >
      <Icon size={32} color={colors[icon]} />
    </View>
  );
}

// The centred art + title + body the boards use for sent, done, suspended and guest states.
export function BigState({
  icon,
  tone,
  title,
  body,
  children,
  level = 'h2',
}: {
  icon: LucideIcon;
  tone?: ArtTone;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  level?: 'h1' | 'h2';
}) {
  return (
    <View className="items-center gap-3 px-2 py-6">
      <StateArt icon={icon} tone={tone} />
      <Text variant={level} accessibilityRole="header" className="text-center">
        {title}
      </Text>
      {body ? <Text className="text-center text-fg-2">{body}</Text> : null}
      {children}
    </View>
  );
}
