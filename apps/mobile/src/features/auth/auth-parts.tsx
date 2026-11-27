import { AlertCircle, Check, Clock, Fingerprint, WifiOff } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { Text } from '../../components/ui/text';
import { type Copy, useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';

export interface FieldModel {
  value: string;
  onChange: (text: string) => void;
  // Already translated by the screen hook.
  error?: string;
}

// 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong (domain passwordStrength).
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface StrengthModel {
  level: StrengthLevel;
  minLength: boolean;
  notCommon: boolean;
  // The "add a number or symbol" tip.
  tip: boolean;
}

// The form-level problem shown above the fields (role alert).
export interface AuthNotice {
  kind: 'error' | 'rateLimited' | 'offline';
  message: string;
  hint?: string;
}

export interface SubmitModel {
  onSubmit: () => void;
  loading: boolean;
  // "0:42" while rate-limited: the button is disabled, inputs stay editable.
  retryIn?: string;
}

const LEVELS = ['weak', 'weak', 'fair', 'good', 'strong'] as const;
const SEGMENT = ['', 'bg-neg', 'bg-warn', 'bg-pos', 'bg-pos'] as const;
const PASSWORD_MIN = 8;

export function StrengthMeter({ strength }: { strength: StrengthModel }) {
  const { t, f } = useCopy();
  const colors = useColors();
  if (strength.level === 0) return null;
  const level = t.auth.strength.levels[LEVELS[strength.level]];
  const rules = [
    { ok: strength.minLength, label: t.auth.strength.minLength({ n: f.number(PASSWORD_MIN) }) },
    { ok: strength.notCommon, label: t.auth.strength.notCommon },
  ];
  return (
    <View className="gap-1.5">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${t.auth.strength.label}: ${level}`}
        accessibilityValue={{ min: 0, max: 4, now: strength.level }}
        className="flex-row gap-1"
      >
        {[1, 2, 3, 4].map((segment) => (
          <View
            key={segment}
            className={cx(
              'h-1 flex-1 rounded-full',
              segment <= strength.level ? SEGMENT[strength.level] : 'bg-surface-3',
            )}
          />
        ))}
      </View>
      <View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
        <Text variant="caption" className="text-fg-3">
          {t.auth.strength.label}
        </Text>
        <Text variant="caption" weight={700}>
          {level}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        {rules.map((rule) => (
          <View
            key={rule.label}
            accessible
            accessibilityLabel={`${rule.label}, ${rule.ok ? t.auth.strength.met : t.auth.strength.notMet}`}
            className="flex-row items-center gap-1"
          >
            <Check size={14} color={rule.ok ? colors.pos : colors['fg-3']} />
            <Text variant="caption" className={rule.ok ? 'text-pos' : 'text-fg-3'}>
              {rule.label}
            </Text>
          </View>
        ))}
      </View>
      {strength.tip ? (
        <Text variant="caption" className="text-fg-3">
          {t.auth.strength.tip}
        </Text>
      ) : null}
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  error,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  error?: string;
  children?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        accessibilityHint={error}
        onPress={() => {
          onChange(!checked);
        }}
        className="min-h-11 flex-row items-center gap-2.5"
      >
        <View
          className={cx(
            'h-5 w-5 items-center justify-center rounded-xs border',
            checked ? 'border-brand bg-brand' : error ? 'border-neg' : 'border-border-strong',
          )}
        >
          {checked ? <Check size={14} color={colors['on-brand']} /> : null}
        </View>
        {children ?? (
          <Text variant="sm" className="flex-1">
            {label}
          </Text>
        )}
      </Pressable>
      {error ? (
        <Text variant="sm" className="text-neg">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const NOTICE_ICON = { error: AlertCircle, rateLimited: Clock, offline: WifiOff } as const;

// No live region: a rate-limit countdown inside must not re-announce every second.
export function NoticeCallout({ notice }: { notice: AuthNotice }) {
  return (
    <View accessible accessibilityRole="alert">
      <Callout
        tone={notice.kind === 'error' ? 'neg' : 'warn'}
        icon={NOTICE_ICON[notice.kind]}
        title={notice.message}
        body={notice.hint ?? ''}
      />
    </View>
  );
}

export function SubmitButton({
  submit,
  label,
  loadingLabel,
  variant = 'primary',
}: {
  submit: SubmitModel;
  label: string;
  loadingLabel: string;
  variant?: 'primary' | 'danger';
}) {
  const { t } = useCopy();
  const colors = useColors();
  if (submit.retryIn)
    return (
      <Button
        size="lg"
        variant="secondary"
        disabled
        icon={<Clock size={16} color={colors['fg-2']} />}
      >
        {t.auth.retryIn({ time: submit.retryIn })}
      </Button>
    );
  return (
    <Button
      size="lg"
      variant={variant}
      loading={submit.loading}
      disabled={submit.loading}
      onPress={submit.onSubmit}
    >
      {submit.loading ? loadingLabel : label}
    </Button>
  );
}

export function OAuthButtons() {
  const { t } = useCopy();
  const providers = [t.auth.oauth.google, t.auth.oauth.apple];
  return (
    <>
      <View className="flex-row items-center gap-3" importantForAccessibility="no-hide-descendants">
        <View className="h-px flex-1 bg-border" />
        <Text variant="caption" className="text-fg-3">
          {t.auth.or}
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>
      <View className="flex-row gap-2.5">
        {providers.map((provider) => (
          // Stays focusable so screen readers announce "coming soon".
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={t.auth.oauth.comingSoonA11y({ provider })}
            accessibilityState={{ disabled: true }}
            className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface-3 px-4 opacity-60"
          >
            <Text variant="button">{provider}</Text>
            <View className="rounded-sm bg-surface px-1.5">
              <Text variant="caption" weight={600} className="text-fg-3">
                {t.auth.oauth.soon}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export function FaceIdRow() {
  const { t } = useCopy();
  const colors = useColors();
  const { label, soon } = t.auth.faceIdParts;
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${soon}`}
      className="min-h-11 flex-row items-center gap-2.5"
    >
      <Fingerprint size={18} color={colors['fg-3']} />
      <Text variant="sm" className="flex-1 text-fg-2">
        {label}
      </Text>
      <View className="rounded-sm bg-surface-3 px-1.5">
        <Text variant="caption" weight={600} className="text-fg-3">
          {soon}
        </Text>
      </View>
    </View>
  );
}

// "I agree to the Terms and Privacy Policy and understand money is virtual." with both names marked.
export function TermsLabel() {
  const { t } = useCopy();
  const parts = t.auth.terms.mobile;
  return (
    <Text variant="sm" className="flex-1">
      {parts.prefix}
      <Text variant="sm" weight={600} className="text-brand-fg">
        {parts.termsLink}
      </Text>
      {parts.and}
      <Text variant="sm" weight={600} className="text-brand-fg">
        {parts.privacyLink}
      </Text>
      {parts.suffix}
    </Text>
  );
}

export function termsText({ t }: Pick<Copy, 't'>): string {
  const parts = t.auth.terms.mobile;
  return `${parts.prefix}${parts.termsLink}${parts.and}${parts.privacyLink}${parts.suffix}`;
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      className="min-h-11 justify-center px-2"
    >
      <Text variant="sm" weight={600} className="text-brand-fg">
        {label}
      </Text>
    </Pressable>
  );
}
