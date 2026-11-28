# ADR 0010: Arabic and right-to-left as a first-class locale

## Status

Accepted

## Context

Sarwa serves the Gulf market, where many customers read Arabic first. Arabic is not just translated strings: the layout mirrors (right to left), plural rules have six forms, some users prefer Arabic-Indic digits and others Western digits, and people type numbers with Arabic keyboards. If Arabic is added at the end, every screen needs rework, and a server-rendered page that guesses the language wrong flashes English before it switches.

## Decision

- **Two locales from the start, EN and AR**, in `@sarwa/i18n`. Every user-facing string on web, mobile and admin comes from the catalogs; no hard-coded copy. Tests check that the catalogs match.
- **Plural rules are written out** (CLDR cardinal categories `zero`, `one`, `two`, `few`, `many`, `other`) because Hermes on Android has no `Intl.PluralRules`.
- **Digits are a separate user setting**, independent of language: `latn` (Western, the default even in Arabic, as the design asks) or `arab` (Arabic-Indic). The shared formatters (`f`) apply it to every price, quantity and date, including the currency affix.
- **Inputs accept Arabic digits.** `normalizeDecimal` in `@sarwa/domain` maps Arabic-Indic and Persian digits to 0-9 and the Arabic decimal separator to a dot before parsing, so the order ticket, alert targets and admin forms accept what an Arabic keyboard types.
- **Web renders the right language on the server.** Language and digits are stored in cookies (`sarwa.locale`, `sarwa.digits`). The root layout reads them and renders `<html lang dir>` and the page copy (including metadata) on the server, so there is no English flash and no hydration mismatch. Open Graph `locale` is `ar_AE` for Arabic.
- **Mobile mirrors with a root `direction` style** in the app providers (and in sheets and route fallbacks), so switching language flips the layout at once without the app restart that `I18nManager.forceRTL` needs. Directional icons are flipped explicitly. Only the watchlist and position swipes are kept physical in RTL; the alerts swipe is a known limitation. The numeric keypad stays left to right.
- **Fonts:** IBM Plex Sans Arabic on web, loaded on first use rather than preloaded, so English pages do not pay for it.
- Layouts use logical properties (start and end) so the same styles work both ways.

## Why

- The target market reads Arabic; treating it as a first-class locale is a product requirement, not polish.
- Cookie-driven server rendering gives a correct first paint in either language.
- A separate digits setting matches how Gulf users actually read numbers in finance apps.
- Normalizing input in the domain package means every client gets it for free.

## Alternatives considered

- **Locale in the URL (`/ar/...`) with hreflang:** better for SEO per language, and it unlocks static or partially prerendered pages. Deferred: it is the planned next step, and `/ar` URLs are ignored today.
- **i18next or FormatJS:** mature, but heavy for two locales and harder to share across React Native, Next server components and the NestJS server. A small typed catalog is enough.
- **`I18nManager.forceRTL` on mobile:** the platform way, but it needs a reload to take effect.

## Consequences

- Good: Arabic users get a mirrored, fully translated product on every platform, with their choice of digits.
- Good: number entry works with any keyboard.
- Bad: every new string must be written twice; every screen must be checked in RTL.
- Bad: reading cookies in the root layout makes every web page render per request, so pages cannot be fully static (the 5-second data cache softens this, ADR 0002).
- Bad: one URL serves both languages, so search engines index only one of them until locale-in-URL ships.
