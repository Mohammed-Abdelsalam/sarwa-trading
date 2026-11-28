# Design: the Mini Trading UI kit

Every screen in this repo was designed before it was coded. The kit was built in **Claude Design**: 41 boards across eight pages, covering the design system and every screen of the mobile app, the website and the admin dashboard, in light and dark. Below is a curated tour of the key boards. The full kit has every board and state.

<p align="center"><b><a href="mini-trading-ui-kit.pdf">Download the full UI kit (PDF, 50 pages, bookmarked)</a></b></p>

**Contents:** [Design system](#1-design-system) · [Mobile app](#2-mobile-app) · [Web app](#3-web-app) · [Admin dashboard](#4-admin-dashboard) · [Trading features](#5-trading-features) · [Accounts and auth](#6-accounts-and-auth) · [Extras](#7-extras-rtl-architecture-accessibility) · [From design to code](#from-design-to-code)

## 1. Design system

Semantic colour tokens for light and dark with WCAG contrast ratios, the type scale (Inter, Manrope, JetBrains Mono, tabular numbers), a 4 pt spacing grid, radii, elevation and motion with reduced-motion variants.

<img src="foundations.png" alt="Foundations: colour tokens, typography, spacing, radii, elevation and motion" width="100%">

Every core component in every state (default, hover, pressed, focus, disabled, loading), in both themes.

<img src="boards/core-components.jpg" alt="Core components in every variant and state" width="100%">

The live-data vocabulary shared by all three apps: PriceText, PriceFlash (400 ms), ChangePill, StarButton, ConnectionBadge, Sparkline, PeriodTabs and StockRow.

<img src="trading-components.png" alt="Trading components" width="100%">

## 2. Mobile app

<table>
<tr>
<td width="40%" align="center"><img src="boards/mobile-markets.jpg" alt="Mobile markets with live prices" width="100%"><br><sub><b>Markets</b>: live list, search, sector chips</sub></td>
<td width="60%" align="center"><img src="mobile-stock-detail.png" alt="Mobile stock detail with chart periods" width="100%"><br><sub><b>Stock detail</b>: live price, chart periods, key stats</sub></td>
</tr>
</table>

<img src="boards/mobile-watchlist.jpg" alt="Mobile watchlist, light and dark" width="100%">

## 3. Web app

Responsive from phone to desktop, with a two-pane markets view on large screens.

<img src="boards/web-markets.jpg" alt="Web markets across breakpoints" width="100%">

<img src="boards/web-stock-detail.jpg" alt="Web stock detail" width="100%">

## 4. Admin dashboard

<img src="boards/admin-overview.jpg" alt="Admin overview" width="100%">

<img src="boards/admin-market.jpg" alt="Admin market control room" width="100%">

## 5. Trading features

The full order flow on mobile: home, portfolio, order ticket, review with a quote countdown and slide to confirm, then the filled result.

<img src="boards/mobile-trading.jpg" alt="Mobile trading: home, portfolio, ticket, review, filled" width="100%">

<img src="boards/web-trading.jpg" alt="Web stock detail with the order panel" width="100%">

## 6. Accounts and auth

Account flows first, then the screens: guests browse freely and sign in at the moment of a personal action.

<img src="boards/account-flows.jpg" alt="Account and auth flows" width="100%">

<img src="boards/mobile-auth.jpg" alt="Mobile sign-in and sign-up" width="100%">

<img src="boards/admin-customers.jpg" alt="Admin customers list" width="100%">

## 7. Extras: RTL, architecture, accessibility

<img src="boards/arabic-rtl.jpg" alt="Arabic and RTL" width="100%">

<img src="boards/live-data-architecture.jpg" alt="Live data architecture" width="100%">

<img src="boards/accessibility.jpg" alt="Accessibility and edge cases" width="100%">

## From design to code

- **One token source.** [`@sarwa/tokens`](../../packages/tokens/README.md) holds the kit's colour roles, type scale, spacing, radii, shadows and motion. It generates the CSS variables for web and admin (Tailwind v4) and the preset for mobile (NativeWind), so all three apps read the same names.
- **Enforced by lint.** Raw hex colours and font files are rejected outside the tokens, and token tests check the colour contrast pairs.
- **The kit's rules ship in the product.** Price colour is never the only signal (▲/▼ and +/−), prices use tabular numbers, the price flash is 400 ms, and motion respects reduced-motion settings.

How the design brief and spec were written with AI: [design brief](../ai/prompts/03-design-accounts-and-auth.md) · [written spec with gaps G1–G30](../ai/prompts/05-accounts-design-spec.md) · [AI workflow](../ai/WORKFLOW.md).
