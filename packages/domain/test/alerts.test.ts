import {
  ALERT_CONDITIONS,
  ALERT_REPEATS,
  type AlertRule,
  type AlertState,
  evaluateAlert,
  isAlertMet,
  moveTodayBps,
  validateAlert,
} from '../src/alerts';
import { POLICY } from '../src/rules';

const PREV = 1_000_000;
const px = (lastTicks: number) => ({ lastTicks, prevCloseTicks: PREV });
const above = (thresholdTicks: number | null): AlertRule => ({
  condition: 'price_above',
  thresholdTicks,
  thresholdBps: null,
});
const below = (thresholdTicks: number | null): AlertRule => ({
  condition: 'price_below',
  thresholdTicks,
  thresholdBps: null,
});
const moved = (thresholdBps: number | null): AlertRule => ({
  condition: 'move_today',
  thresholdTicks: null,
  thresholdBps,
});
const armed = (repeat: AlertState['repeat']): AlertState => ({
  repeat,
  armed: true,
  lastFiredAt: null,
});

describe('isAlertMet', () => {
  it('meets a price threshold at or beyond it', () => {
    expect(isAlertMet(above(1_050_000), px(1_050_000))).toBe(true);
    expect(isAlertMet(above(1_050_000), px(1_049_999))).toBe(false);
    expect(isAlertMet(below(950_000), px(950_000))).toBe(true);
    expect(isAlertMet(below(950_000), px(950_001))).toBe(false);
  });

  it('meets a signed move threshold on the day', () => {
    expect(moveTodayBps(px(1_050_000))).toBe(500);
    expect(isAlertMet(moved(500), px(1_050_000))).toBe(true);
    expect(isAlertMet(moved(500), px(1_049_000))).toBe(false);
    expect(isAlertMet(moved(-500), px(950_000))).toBe(true);
    expect(isAlertMet(moved(-500), px(951_000))).toBe(false);
  });

  it('is never met without a threshold', () => {
    expect(isAlertMet(above(null), px(PREV))).toBe(false);
    expect(isAlertMet(below(null), px(PREV))).toBe(false);
    expect(isAlertMet(moved(null), px(PREV))).toBe(false);
    expect(isAlertMet(moved(0), px(PREV))).toBe(false);
  });
});

describe('validateAlert', () => {
  it.each(ALERT_CONDITIONS.flatMap((condition) => [null, 0].map((v) => [condition, v] as const)))(
    'rejects a %s alert with a %p threshold',
    (condition, value) => {
      const rule: AlertRule = { condition, thresholdTicks: value, thresholdBps: value };

      expect(validateAlert(rule, px(PREV))).toEqual({ code: 'MISSING_THRESHOLD' });
    },
  );

  it('rejects an alert that is already true', () => {
    expect(validateAlert(above(990_000), px(PREV))).toEqual({
      code: 'ALREADY_ABOVE',
      lastTicks: PREV,
    });
    expect(validateAlert(below(1_010_000), px(PREV))).toEqual({
      code: 'ALREADY_BELOW',
      lastTicks: PREV,
    });
    expect(validateAlert(moved(-300), px(960_000))).toEqual({
      code: 'ALREADY_MOVED',
      moveBps: -400,
    });
  });

  it('accepts an alert that is not yet true', () => {
    expect(validateAlert(above(1_010_000), px(PREV))).toBeNull();
    expect(validateAlert(moved(300), px(1_020_000))).toBeNull();
  });
});

describe('evaluateAlert', () => {
  const rule = above(1_050_000);
  const COOLDOWN = POLICY.alertCooldownMs;

  it('does nothing while the condition is not met', () => {
    const state = armed('every');

    expect(evaluateAlert(rule, state, px(1_000_000), 0)).toEqual({ fire: false, state });
  });

  it.each(ALERT_REPEATS)('fires a "%s" alert on the crossing and disarms it', (repeat) => {
    expect(evaluateAlert(rule, armed(repeat), px(1_050_000), 1_000)).toEqual({
      fire: true,
      state: { repeat, armed: false, lastFiredAt: 1_000 },
    });
  });

  it('does not fire again while the price stays beyond the threshold', () => {
    const fired = evaluateAlert(rule, armed('every'), px(1_050_000), 0).state;

    const later = evaluateAlert(rule, fired, px(1_060_000), COOLDOWN * 2);

    expect(later).toEqual({ fire: false, state: fired });
  });

  it('re-arms "every" only after the price is back AND the cooldown has passed', () => {
    const fired = evaluateAlert(rule, armed('every'), px(1_050_000), 0).state;

    const backTooSoon = evaluateAlert(rule, fired, px(1_000_000), COOLDOWN - 1);
    const backAfterCooldown = evaluateAlert(rule, fired, px(1_000_000), COOLDOWN);
    const crossesAgain = evaluateAlert(rule, backAfterCooldown.state, px(1_051_000), COOLDOWN + 1);

    expect(backTooSoon.state.armed).toBe(false);
    expect(backAfterCooldown).toEqual({ fire: false, state: { ...fired, armed: true } });
    expect(crossesAgain.fire).toBe(true);
  });

  it('never re-arms a "once" alert', () => {
    const fired = evaluateAlert(rule, armed('once'), px(1_050_000), 0).state;

    const back = evaluateAlert(rule, fired, px(1_000_000), COOLDOWN * 10);
    const crossesAgain = evaluateAlert(rule, back.state, px(1_051_000), COOLDOWN * 11);

    expect(back.state.armed).toBe(false);
    expect(crossesAgain.fire).toBe(false);
  });

  it('arms a disarmed "every" alert that has never fired once the price is on the other side', () => {
    const idle: AlertState = { repeat: 'every', armed: false, lastFiredAt: null };

    expect(evaluateAlert(rule, idle, px(1_000_000), 0).state.armed).toBe(true);
  });
});
