import {
  type AlertCondition,
  type AuthFieldError,
  type AlertRepeat,
  type CancelReason,
  type OrderStatus,
  type OrderType,
  type SessionPhase,
  type Side,
  type SuspensionCategory,
  type TimeInForce,
} from '@sarwa/domain';

import { type AlertIssueCopy, type Count, type RejectionCopy } from '../copy';
import { plural } from '../locale';

interface N {
  n: string;
}

interface Amount {
  amount: string;
}

interface SymbolParam {
  symbol: string;
}

type DeviceTime = Record<'device' | 'time', string>;

const hours = ({ count, n }: Count) =>
  `${n} ${plural('en', count, { one: 'hour', other: 'hours' })}`;

const rejections: RejectionCopy = {
  TRADING_DISABLED: () => ({
    reason: 'Trading paused by operator',
    explanation:
      'Trading is paused by the operator. Prices keep streaming and your open orders keep working.',
  }),
  MARKET_PAUSED: () => ({
    reason: 'Trading paused — market paused',
    explanation:
      'The simulated market is paused. New orders are blocked until it resumes; open orders keep working.',
  }),
  SYMBOL_HALTED: ({ symbol }) => ({
    reason: `Trading paused — ${symbol} halted`,
    explanation: `${symbol} is halted. New orders are rejected and open orders are paused, not canceled. Prices keep streaming.`,
  }),
  MARKET_CLOSED: () => ({
    reason: 'Market closed',
    explanation:
      "The market is closed and market orders aren't being queued for the open. Use a limit order or try again when the market opens.",
  }),
  STALE_QUOTE: ({ ageMs, maxAgeMs }) => ({
    reason: `Quote is ${ageMs} s old`,
    explanation: `Quote is ${ageMs} s old. We only accept orders on quotes fresher than ${maxAgeMs} s.`,
  }),
  INVALID_PRICE: ({ field, lastTicks }) =>
    field === 'stop'
      ? {
          reason: 'Stop price would trigger now',
          explanation: `A stop at this price would trigger immediately. Set a buy stop above, or a sell stop below, the last price (${lastTicks}).`,
        }
      : {
          reason: 'Enter a limit price',
          explanation: `A limit price must be above zero. The last price is ${lastTicks}.`,
        },
  PRICE_COLLAR: ({ field, minTicks, maxTicks }) => ({
    reason: `${field === 'limit' ? 'Limit' : 'Stop'} price too far from market`,
    explanation: `Price too far from market (collar: ${minTicks} – ${maxTicks}).`,
  }),
  MIN_NOTIONAL: ({ minCents }) => ({
    reason: `Minimum order is ${minCents}`,
    explanation: `Orders must be worth at least ${minCents}.`,
  }),
  MAX_NOTIONAL: ({ maxCents }) => ({
    reason: `Maximum order is ${maxCents}`,
    explanation: `A single order can't be worth more than ${maxCents}. Split it into smaller orders.`,
  }),
  INSUFFICIENT_FUNDS: ({ requiredCents, availableCents }) => ({
    reason: 'Insufficient buying power',
    explanation: `This order needs ${requiredCents} but you have ${availableCents} of buying power.`,
  }),
  CONNECTION_NOT_LIVE: () => ({
    reason: 'Waiting for live prices',
    explanation:
      "Orders open again as soon as the price stream reconnects. We won't trade on old prices.",
  }),
  STATUS_LOADING: () => ({
    reason: 'Loading…',
    explanation: 'Checking whether trading is open for this stock.',
  }),
  INSUFFICIENT_SHARES: ({ sellableMicros }) => ({
    reason: 'Not enough shares',
    explanation: `You can sell up to ${sellableMicros} sh. Shares reserved by open sell orders can't be sold twice.`,
  }),
};

const alertIssues: AlertIssueCopy = {
  ALREADY_ABOVE: ({ lastTicks }) => ({
    reason: 'Price is already above this target',
    explanation: `“Above” must be over the current price (${lastTicks}) — did you mean “below”?`,
  }),
  ALREADY_BELOW: ({ lastTicks }) => ({
    reason: 'Price is already below this target',
    explanation: `“Below” must be under the current price (${lastTicks}) — did you mean “above”?`,
  }),
  ALREADY_MOVED: ({ symbol, moveBps }) => ({
    reason: `Already moved ${moveBps} today`,
    explanation: `${symbol} has already moved ${moveBps} today — pick a bigger move.`,
  }),
  MISSING_THRESHOLD: () => ({
    reason: 'Enter a target',
    explanation: 'Enter a target price or a % move to create the alert.',
  }),
};

export const en = {
  common: {
    buy: 'Buy',
    sell: 'Sell',
    cancel: 'Cancel',
    done: 'Done',
    retry: 'Retry',
    edit: 'Edit',
    save: 'Save',
    discard: 'Discard',
    close: 'Close',
    back: 'Back',
    dismiss: 'Dismiss',
    view: 'View',
    enable: 'Enable',
    filter: 'Filter',
    exportCsv: 'Export CSV',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    search: 'Search or jump to…',
    justNow: 'Just now',
    minutesAgo: ({ n }: Count) => `${n} min ago`,
    hoursAgo: ({ n }: Count) => `${n} h ago`,
    inTime: ({ time }: { time: string }) => `in ${time}`,
    minutes: ({ n }: Count) => `${n} min`,
    hours,
    sides: { buy: 'BUY', sell: 'SELL' } satisfies Record<Side, string>,
    sharesShort: ({ shares }: { shares: string }) => `${shares} sh`,
    loadErrorBody: 'Check your connection and try again.',
    undo: 'Undo',
    share: 'Share',
    equity: 'Equity',
  },
  sectors: {
    tech: 'Technology',
    fin: 'Finance',
    energy: 'Energy',
    health: 'Healthcare',
    consumer: 'Consumer',
    media: 'Media',
  },
  markets: {
    title: 'Markets',
    stocks: 'Stocks',
    summary: ({ n }: Count) => `${n} stocks · US equities · USD`,
    summaryShort: ({ n }: Count) => `${n} stocks · prices in USD`,
    searchLabel: 'Search stocks',
    clearSearch: 'Clear search',
    sector: 'Sector',
    allSectors: 'All',
    loading: 'Loading stocks',
    updating: 'Updating prices…',
    loadError: "Couldn't load markets",
    loadErrorBody:
      "We couldn't reach the price server. Check your connection — we'll keep trying in the background.",
    noMatchesBody: ({ sector }: { sector: string }) =>
      `Try a ticker like AAPL or a company name like “Netflix”. Sector filter: ${sector}.`,
    detail: ({ symbol }: { symbol: string }) => `${symbol} detail`,
    openFullPage: 'Open full page',
  },
  sort: {
    label: 'Sort',
    keys: { name: 'Name', price: 'Price', change: '% Change' },
    orderAdded: 'Order added',
    ascending: 'ascending',
    descending: 'descending',
    clickToChange: ({ label, order }: { label: string; order: string }) =>
      `Sort by ${label}, ${order}. Click to change`,
    tapToChange: ({ label }: { label: string }) => `Sort by ${label}, tap to change`,
  },
  watchlist: {
    title: 'Watchlist',
    count: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'stock', other: 'stocks' })}`,
    averageToday: 'average today',
    avgToday: 'avg today',
    view: 'View',
    tableView: 'Table view',
    gridView: 'Grid view',
    loadError: "Couldn't load your watchlist",
    loadErrorBody: "We couldn't reach the price server. Check your connection and try again.",
    removed: ({ symbol }: { symbol: string }) => `${symbol} removed from Watchlist`,
    remove: 'Remove',
    addSymbol: ({ symbol }: { symbol: string }) => `Add ${symbol} to watchlist`,
    removeSymbol: ({ symbol }: { symbol: string }) => `Remove ${symbol} from watchlist`,
    addAction: 'Add to watchlist',
    removeAction: 'Remove from watchlist',
    swipeHint: 'Swipe left on a row to remove',
    emptyTitle: 'Your watchlist is empty',
    emptyBody: 'Tap the star on any stock to follow its live price here.',
    emptyKeyHint: {
      before: 'Star any stock in Markets — or press',
      after: 'on a focused row — and it shows up here with live prices.',
    },
    browse: 'Browse markets',
    guestNote: 'Create an account to keep your watchlist on all your devices',
    columns: {
      stock: 'Stock',
      price: 'Price',
      change: 'Change',
      changePct: '% Change',
      today: 'Today',
      dayRange: 'Day range',
      marketCap: 'Market cap',
      actions: 'Actions',
    },
  },
  stock: {
    alert: 'Alert',
    watch: 'Watch',
    watching: 'Watching',
    quoteLabel: {
      up: ({ price, pct }: { price: string; pct: string }) => `${price}, up ${pct} today`,
      down: ({ price, pct }: { price: string; pct: string }) => `${price}, down ${pct} today`,
      flat: ({ price }: { price: string; pct: string }) => `${price}, unchanged today`,
    },
    rowLabel: {
      up: ({ name, symbol, price, pct }: Record<'name' | 'symbol' | 'price' | 'pct', string>) =>
        `${name}, ${symbol}. ${price}. Up ${pct} today.`,
      down: ({ name, symbol, price, pct }: Record<'name' | 'symbol' | 'price' | 'pct', string>) =>
        `${name}, ${symbol}. ${price}. Down ${pct} today.`,
      flat: ({ name, symbol, price }: Record<'name' | 'symbol' | 'price' | 'pct', string>) =>
        `${name}, ${symbol}. ${price}. Unchanged today.`,
    },
    inWatchlist: 'In watchlist.',
    shareMessage: ({
      symbol,
      name,
      price,
      pct,
    }: Record<'symbol' | 'name' | 'price' | 'pct', string>) =>
      `${symbol} · ${name} ${price}, ${pct} today`,
    today: ({ time }: { time: string }) => `Today · ${time}`,
    keyStats: 'Key statistics',
    simulated: 'Simulated data',
    stats: {
      marketCap: 'Market cap',
      pe: 'P/E (TTM)',
      weekHigh: ({ n }: Count) => `${n}W high`,
      weekLow: ({ n }: Count) => `${n}W low`,
      open: 'Open',
      volume: 'Volume',
      sector: 'Sector',
      exchange: 'Exchange',
    },
    range: ({ n }: Count) => `${n}-week range`,
    rangeLabel: ({ n }: Count) => `Price within the ${n}-week range`,
    rangeValue: ({ pct, low, high }: Record<'pct' | 'low' | 'high', string>) =>
      `${pct} of the way from ${low} to ${high}`,
    loadError: ({ symbol }: { symbol: string }) => `Couldn't load ${symbol}`,
    moreIn: ({ sector }: { sector: string }) => `More in ${sector}`,
    moreInSector: 'More in this sector',
    removedTitle: 'This stock is no longer available',
    removedBody: ({ symbol }: { symbol: string }) =>
      `${symbol} was removed from Mini Trading. You opened an old link — prices for it are no longer streaming.`,
    backToMarkets: 'Back to Markets',
    removeFromWatchlist: 'Remove from Watchlist',
  },
  chart: {
    label: ({ symbol }: { symbol: string }) => `${symbol} price chart`,
    empty: ({ symbol, period }: { symbol: string; period: string }) =>
      `${symbol} price chart, ${period}`,
    summary: {
      up: ({
        symbol,
        pct,
        when,
        low,
        high,
      }: Record<'symbol' | 'pct' | 'when' | 'low' | 'high', string>) =>
        `${symbol} up ${pct} ${when}, low ${low}, high ${high}`,
      down: ({
        symbol,
        pct,
        when,
        low,
        high,
      }: Record<'symbol' | 'pct' | 'when' | 'low' | 'high', string>) =>
        `${symbol} down ${pct} ${when}, low ${low}, high ${high}`,
      flat: ({
        symbol,
        when,
        low,
        high,
      }: Record<'symbol' | 'pct' | 'when' | 'low' | 'high', string>) =>
        `${symbol} flat ${when}, low ${low}, high ${high}`,
    },
    today: 'today',
    over: ({ period }: { period: string }) => `over ${period}`,
    thisPeriod: 'this period',
    type: 'Chart type',
    types: { area: 'Area', candle: 'Candlestick' },
    period: 'Chart period',
    loading: 'Loading chart',
    unavailable: 'Chart unavailable',
    unavailableBody: ({ period }: { period: string }) =>
      `We couldn't load ${period} history. Live price above is still updating.`,
    ohlc: { open: 'Open', high: 'High', low: 'Low', close: 'Close' },
  },
  notices: {
    offlineTitle: "You're offline",
    offline: '— showing cached prices.',
    offlineSince: ({ time }: { time: string }) => `— showing cached prices from ${time}.`,
    reconnecting: 'Prices may be a few seconds behind.',
    attempt: ({ n }: Count) => `try ${n}`,
    paused: ({ time }: { time: string }) =>
      `— prices are frozen at ${time} and will resume automatically.`,
  },
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    themes: { light: 'Light', dark: 'Dark', system: 'Follows system' },
    languageRegion: 'Language & numbers',
    language: 'Language',
    languages: { en: 'English', ar: 'العربية' },
    digits: 'Digits',
    digitOptions: {
      latn: ({ sample }: { sample: string }) => `Western · ${sample}`,
      arab: ({ sample }: { sample: string }) => `Arabic-Indic · ${sample}`,
    },
  },
  search: {
    title: 'Search',
    placeholder: 'Search symbol or company',
    recent: 'Recent searches',
    clearRecent: 'Clear',
    trending: 'Trending',
    noMatches: ({ query }: { query: string }) => `No matches for “${query}”`,
  },
  csv: {
    portfolio: {
      symbol: 'Symbol',
      shares: 'Shares',
      avgCost: 'Avg cost',
      last: 'Last',
      marketValue: 'Market value',
      today: 'Today',
      unrealized: 'Unrealized P&L',
      totalReturn: 'Total return',
      weight: 'Weight',
    },
    orders: {
      id: 'Order ID',
      side: 'Side',
      symbol: 'Symbol',
      type: 'Type',
      size: 'Qty / amount',
      status: 'Status',
      detail: 'Detail',
      time: 'Time',
    },
  },
  nav: {
    home: 'Home',
    markets: 'Markets',
    portfolio: 'Portfolio',
    watchlist: 'Watchlist',
    orders: 'Orders',
    account: 'Account',
    alerts: 'Alerts',
    notifications: 'Notifications',
    main: 'Main',
  },
  paper: {
    badge: 'Paper · virtual $',
    tag: 'PAPER',
    account: 'Paper account',
    disclosure: 'Simulated prices · virtual money · not investment advice',
    tradingDisclosure: 'Paper trading · simulated prices · not investment advice',
    orderNote:
      'Paper order on simulated prices. Market orders can fill at a slightly different price than the quote.',
    virtualStart: 'Virtual start',
  },
  notFound: {
    metaTitle: 'Not found',
    title: 'Page not found',
    body: "This link doesn't lead anywhere in Mini Trading.",
    back: 'Back to Markets',
  },
  errorPage: {
    title: 'Something went wrong',
    body: 'Something unexpected happened. Your watchlist is safe.',
    retry: 'Try again',
  },
  market: {
    open: ({ time }: { time: string }) => `Open · closes ${time}`,
    openClosesIn: ({ duration }: { duration: string }) => `Open · closes in ${duration}`,
    closed: ({ time }: { time: string }) => `Closed · opens ${time}`,
    earlyClose: ({ time }: { time: string }) => `Early close · ${time}`,
    preMarket: ({ time }: { time: string }) => `Pre-market · opens ${time}`,
    afterHours: 'After hours',
    halted: ({ symbol }: { symbol: string }) => `${symbol} is halted.`,
    circuitBreaker: ({ move, duration }: { move: string; duration: string }) =>
      `Circuit breaker: moved ${move} in ${duration}.`,
    resumesAt: ({ time }: { time: string }) => `Trading resumes at ${time}`,
    closesEarlyTitle: 'Markets close early today',
    closesEarlyBody: ({ time }: { time: string }) => `at ${time} — open Day orders expire then.`,
    states: {
      open: 'Open',
      closed: 'Closed',
      pre: 'Pre-market',
      post: 'After hours',
      halted: 'Halted',
      reconnecting: 'Reconnecting…',
      offline: 'Offline',
      connecting: 'Connecting…',
      paused: 'Market paused',
      live: 'Live',
    },
    phases: {
      pre: 'Pre-market',
      regular: 'Regular session',
      post: 'After hours',
      closed: 'Closed',
    } satisfies Record<SessionPhase, string>,
  },
  ticket: {
    a11yLabel: 'Order ticket',
    sideLabel: 'Side',
    buyTitle: ({ symbol }: { symbol: string }) => `Buy ${symbol}`,
    sellTitle: ({ symbol }: { symbol: string }) => `Sell ${symbol}`,
    sellHeld: ({ shares }: { shares: string }) => `Sell · ${shares} sh`,
    bid: ({ price, size }: { price: string; size: string }) => `Bid ${price} × ${size}`,
    ask: ({ price, size }: { price: string; size: string }) => `Ask ${price} × ${size}`,
    spread: ({ pct }: { pct: string }) => `Spread ${pct}`,
    types: {
      market: 'Market',
      limit: 'Limit',
      stop: 'Stop',
    } satisfies Record<OrderType, string>,
    marketHintBuy: 'Market order · fills at the best available ask',
    marketHintSell: 'Market order · fills at the best available bid',
    limitHint: ({ price }: { price: string }) => `fills only at ${price} or better`,
    amount: '$',
    shares: 'Shares',
    quantity: 'Quantity',
    max: 'Max',
    limitPrice: 'Limit price',
    stopPrice: 'Stop price',
    belowLast: ({ pct }: { pct: string }) => `${pct} below last`,
    aboveLast: ({ pct }: { pct: string }) => `${pct} above last`,
    collar: ({ min, max }: { min: string; max: string }) => `collar ${min} – ${max}`,
    sharesAtAsk: ({ shares, price }: { shares: string; price: string }) =>
      `≈ ${shares} shares at ask ${price}`,
    sharesAtBid: ({ shares, price }: { shares: string; price: string }) =>
      `≈ ${shares} shares at bid ${price}`,
    sellUpTo: ({ shares, reserved }: { shares: string; reserved: string }) =>
      `You can sell up to ${shares} shares (${reserved} reserved by open orders)`,
    timeInForce: 'Time in force',
    tif: {
      day: 'Day',
      gtc: 'GTC',
    } satisfies Record<TimeInForce, string>,
    gtcLong: ({ n }: Count) => `Good till canceled (GTC · ${n} days)`,
    orderType: 'Order type',
    estPriceAsk: 'Est. price (ask)',
    estPriceBid: 'Est. price (bid)',
    estShares: 'Est. shares',
    estCost: 'Est. cost',
    estProceeds: 'Est. proceeds',
    estFees: 'Est. fees',
    estTotal: 'Est. total',
    estCostAtClose: 'Est. cost (at last close)',
    buyingPower: 'Buying power',
    buyingPowerAfter: 'Buying power after',
    afterOrder: 'After order',
    reservedCash: 'Reserved cash',
    fees: 'Fees',
    maxCost: 'Max cost',
    keypad: {
      decimalPoint: 'Decimal point',
      delete: 'Delete',
    },
    review: 'Review order',
    reviewBuy: 'Review buy order',
    reviewSell: 'Review sell order',
    placeBuy: 'Place buy order',
    placeSell: 'Place sell order',
    queueForOpen: 'Queue order for open',
    buyAmountOf: ({ amount, symbol }: { amount: string; symbol: string }) =>
      `Buy ${amount} of ${symbol}`,
    sellAmountOf: ({ amount, symbol }: { amount: string; symbol: string }) =>
      `Sell ${amount} of ${symbol}`,
    buyShares: ({ shares, symbol }: { shares: string; symbol: string }) =>
      `Buy ${shares} ${symbol}`,
    sellShares: ({ shares, symbol }: { shares: string; symbol: string }) =>
      `Sell ${shares} ${symbol}`,
    slideToBuy: 'Slide to buy',
    slideToSell: 'Slide to sell',
    slideAlternative: ({ label }: { label: string }) =>
      `Screen reader: double-tap the “${label}” button instead`,
    quoteValid: ({ n }: Count) => `Quote valid for ${n} s`,
    autoRefreshes: 'auto-refreshes',
    largeOrderTitle: 'Large order',
    largeOrderBody: ({ pct }: { pct: string }) =>
      `This order is ${pct} of your account equity. Make sure that's what you meant.`,
    largeOrderConfirm: 'Yes, place order',
    restingBuy: ({ ask, price }: { ask: string; price: string }) =>
      `Your limit is below the current ask (${ask}), so this order will rest on the book until the price drops to ${price}. It can fill partially.`,
    restingSell: ({ bid, price }: { bid: string; price: string }) =>
      `Your limit is above the current bid (${bid}), so this order will rest on the book until the price rises to ${price}. It can fill partially.`,
    marketClosedTitle: 'Market is closed.',
    marketClosedBody: ({ time }: { time: string }) =>
      `A market order will be queued and placed at the open — ${time} — at whatever the opening price is. Use a Limit order to cap your price.`,
    lastClose: 'Last close',
    reservedWithBuffer: ({ pct }: { pct: string }) => `Reserved incl. ${pct} buffer`,
    bufferNote: ({ pct }: { pct: string }) =>
      `We reserve a ${pct} buffer for market orders queued while closed; unused cash is released at fill.`,
    filledTitle: 'Order filled',
    queuedTitle: 'Order queued',
    queuedBody: ({ time }: { time: string }) => `It will be placed at the open — ${time}.`,
    youBought: ({ shares, symbol, amount }: { shares: string; symbol: string; amount: string }) =>
      `You bought ${shares} ${symbol} for ${amount}`,
    youSold: ({ shares, symbol, amount }: { shares: string; symbol: string; amount: string }) =>
      `You sold ${shares} ${symbol} for ${amount}`,
    avgFillPrice: 'Avg fill price',
    vsQuote: 'vs quote',
    slippage: ({ amount }: { amount: string }) => `${amount} slippage`,
    filledAt: 'Filled',
    orderId: 'Order ID',
    newPosition: 'New position',
    avgCost: 'Avg cost',
    weight: 'Weight',
    viewPosition: 'View position',
    setAlert: 'Set alert',
    stopHintBuy: ({ price }: { price: string }) =>
      `becomes a market buy if the price reaches ${price}`,
    stopHintSell: ({ price }: { price: string }) =>
      `becomes a market sell if the price falls to ${price}`,
    quantityShares: ({ shares }: { shares: string }) => `${shares} shares`,
    quoteValidityA11y: 'Quote validity',
    largeOrderToggle: 'I understand, this is a large order',
    placedTitle: 'Order placed',
    placedBody: 'Your order is working on the book. You can track it in Orders.',
    sendFailed: "Couldn't send the order",
    sendFailedBody: 'Your order was not confirmed. Retrying is safe — it can never fill twice.',
  },
  orderStatus: {
    sending: 'Sending…',
    queued: 'Queued for open',
    open: 'Open',
    partially_filled: 'Partially filled',
    filled: 'Filled',
    canceled: 'Canceled',
    rejected: 'Rejected',
    expired: 'Expired',
  } satisfies Record<OrderStatus | 'sending', string>,
  orders: {
    title: 'Orders',
    details: 'Order details',
    openTab: ({ n }: Count) => `Open · ${n}`,
    filledTab: 'Filled',
    allTab: 'All',
    allSymbols: 'All symbols',
    lastDays: ({ n }: Count) => `Last ${n} days`,
    columns: {
      order: 'Order',
      type: 'Type',
      qtyAmount: 'Qty / amount',
      status: 'Status',
      detail: 'Detail',
      time: 'Time',
      actions: 'Actions',
    },
    summary: ({ n, reserved, time }: Count & { reserved: string; time: string }) =>
      `${n} open · ${reserved} reserved · Day orders expire at ${time} today`,
    partial: 'Partial',
    filledOf: ({ filled, total }: { filled: string; total: string }) =>
      `Filled ${filled} / ${total}`,
    filledOfA11y: ({ filled, total }: { filled: string; total: string }) =>
      `Filled ${filled} of ${total}`,
    avg: ({ price }: { price: string }) => `Avg ${price}`,
    placed: 'Order placed',
    accepted: 'Accepted by exchange sim',
    reserved: ({ shares }: { shares: string }) => `reserved ${shares} sh`,
    partiallyFilled: ({ shares, price }: { shares: string; price: string }) =>
      `Partially filled · ${shares} @ ${price}`,
    filledLine: ({ shares, price }: { shares: string; price: string }) =>
      `Filled ${shares} @ ${price}`,
    filledAtPrice: ({ price }: { price: string }) => `Filled @ ${price}`,
    working: ({ shares }: { shares: string }) => `Working · ${shares} remaining`,
    workingAmount: ({ amount }: { amount: string }) => `Working · ${amount} remaining`,
    reservedCash: ({ amount }: { amount: string }) => `reserved ${amount}`,
    expiresAtClose: ({ time }: { time: string }) => `Expires at today's close · ${time}`,
    earlyCloseNote: '(early close)',
    triggersAbove: ({ price }: { price: string }) => `Triggers if ≥ ${price}`,
    triggersBelow: ({ price }: { price: string }) => `Triggers if ≤ ${price}`,
    lastAway: ({ price, pct }: { price: string; pct: string }) => `Last ${price} · ${pct} away`,
    canceledBy: {
      user: 'Canceled by you',
      admin_reset: 'Canceled · account reset',
      symbol_disabled: 'Canceled · stock no longer trades',
      account_suspended: 'Canceled · account suspended',
    } satisfies Record<CancelReason, string>,
    expiredAtClose: 'Expired at close',
    proceedsSoFar: 'Proceeds so far',
    costSoFar: 'Cost so far',
    realizedPl: 'Realized P&L',
    lastPrice: 'Last price',
    modify: 'Modify',
    cancelRemaining: 'Cancel remaining',
    cancelOrder: 'Cancel order',
    alreadyFilledTitle: 'Already filled',
    alreadyFilledBody:
      'This order filled before the cancel reached the market, so there was nothing left to cancel.',
    canceled: 'Order canceled',
    empty: 'No orders yet',
    orderA11y: ({ id }: { id: string }) => `Order ${id}`,
    editA11y: 'Edit order',
  },
  portfolio: {
    title: 'Portfolio',
    totalEquity: 'Total equity',
    totalEquityPaper: 'Total equity · paper account',
    today: 'today',
    allTime: 'All-time',
    sinceStart: ({ amount }: { amount: string }) => `since start (${amount})`,
    cash: 'Cash',
    reserved: 'Reserved by open orders',
    buyingPower: 'Buying power',
    unrealized: 'Unrealized',
    unrealizedPl: 'Unrealized P&L',
    realizedYtd: 'Realized YTD',
    realizedPlYtd: 'Realized P&L (YTD)',
    allocation: 'Allocation',
    allocationA11y: 'Allocation by sector',
    equityChart: ({ duration }: { duration: string }) => `Equity · ${duration} snapshots`,
    positions: ({ n }: Count) => `Positions · ${n}`,
    sortByValue: 'Value',
    columns: {
      position: 'Position',
      shares: 'Shares',
      avgCost: 'Avg cost',
      last: 'Last',
      marketValue: 'Market value',
      today: 'Today',
      totalReturn: 'Total return',
      weight: 'Weight',
      actions: 'Actions',
    },
    yourPosition: 'Your position',
    openOrdersLink: ({ count, n }: Count) =>
      `${n} open ${plural('en', count, { one: 'order', other: 'orders' })} · View`,
    openOrders: 'Open orders',
    alertsActive: ({ n }: Count) => `${n} active`,
    topMovers: 'Top movers',
    gainers: 'Gainers',
    losers: 'Losers',
    active: 'Active',
    sectorHeatmap: 'Sector heatmap',
    heatmapHint: "Size = market cap · colour = today's move",
    recentActivity: 'Recent activity',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    empty: 'No positions yet. Buy a stock to start your paper portfolio.',
    howPl: 'How P&L works',
    howPlA11y: 'How P&L is calculated',
    howPlBody:
      'We use average cost: every buy updates the average price you paid per share. Unrealized P&L is what your shares are worth now minus that average cost. When you sell, the difference between the sale price and your average cost becomes realized P&L. Selling never changes the average cost of the shares you keep.',
  },
  alerts: {
    title: 'Price alerts',
    countShort: ({ n, max }: { n: string; max: string }) => `${n}/${max}`,
    activeOf: ({ n, max }: { n: string; max: string }) => `${n} active of ${max}`,
    delivery: 'delivered by browser notification and in-app',
    newAlert: 'New alert',
    newAlertFor: ({ symbol }: { symbol: string }) => `New alert · ${symbol}`,
    now: ({ price, change }: { price: string; change: string }) => `Now ${price} · ${change} today`,
    conditions: {
      price_above: 'Price above',
      price_below: 'Price below',
      move_today: '% move today',
    } satisfies Record<AlertCondition, string>,
    priceAbove: ({ price }: { price: string }) => `Price above ${price}`,
    priceBelow: ({ price }: { price: string }) => `Price below ${price}`,
    moveAtLeast: ({ pct }: { pct: string }) => `Day change ≥ ${pct}`,
    moveAtMost: ({ pct }: { pct: string }) => `Day change ≤ ${pct}`,
    targetPrice: 'Target price',
    targetMove: 'Target move',
    aboveCurrent: ({ pct }: { pct: string }) => `${pct} above current price`,
    belowCurrent: ({ pct }: { pct: string }) => `${pct} below current price`,
    away: ({ price, pct }: { price: string; pct: string }) => `Now ${price} · ${pct} away`,
    todayMove: ({ pct }: { pct: string }) => `Today ${pct}`,
    triggeredAt: ({ time, price }: { time: string; price: string }) =>
      `Triggered ${time} at ${price}`,
    repeat: 'Repeat',
    repeats: {
      once: 'Once',
      every: 'Every time',
    } satisfies Record<AlertRepeat, string>,
    everyWithCooldown: ({ duration }: { duration: string }) => `Every time (${duration} cooldown)`,
    recurring: 'Recurring',
    states: {
      active: 'Active',
      paused: 'Paused',
      triggered: 'Triggered',
    },
    pushNotification: 'Push notification',
    create: 'Create alert',
    columns: {
      symbol: 'Symbol',
      condition: 'Condition',
      distance: 'Distance',
      repeat: 'Repeat',
    },
    actionsA11y: 'Alert actions',
    limitReached: ({ max }: { max: string }) =>
      `You've reached ${max} active alerts. Delete one to add another.`,
    browserPermissionTitle: 'Turn on browser notifications',
    browserPermissionBody: 'to hear about alerts when this tab is closed.',
    pushPrimingTitle: 'Get notified when it happens',
    pushPrimingBody:
      "We'll only notify you when your alerts trigger or your orders fill. You can turn this off anytime.",
    pushPrimingAllow: 'Turn on notifications',
    pushPrimingLater: 'Not now',
    empty: 'No alerts yet. Set one from any stock page.',
  },
  notifications: {
    title: 'Notifications',
    unreadA11y: ({ n }: Count) => `Notifications, ${n} unread`,
    unread: 'Unread',
    today: 'Today',
    earlier: 'Earlier',
    markAllRead: 'Mark all read',
    settings: 'Notification settings',
    empty: "You're all caught up.",
    orderFilled: 'Order filled',
    orderPartiallyFilled: 'Order partially filled',
    boughtBody: ({ shares, symbol, amount }: Record<'shares' | 'symbol' | 'amount', string>) =>
      `Bought ${shares} ${symbol} for ${amount}`,
    soldBody: ({ shares, symbol, amount }: Record<'shares' | 'symbol' | 'amount', string>) =>
      `Sold ${shares} ${symbol} for ${amount}`,
    orderLabel: ({ side, symbol }: { side: string; symbol: string }) => `${side} ${symbol}`,
    orderCanceled: 'Order canceled',
    orderCanceledBody: ({ order }: { order: string }) => `${order} was canceled.`,
    symbolHalted: ({ symbol }: { symbol: string }) => `${symbol} halted`,
    marketNotice: 'Market notice',
    orderRejected: 'Order rejected',
    orderRejectedBody: ({ order, reason }: { order: string; reason: string }) =>
      `${order} — ${reason}.`,
    orderExpired: 'Order expired',
    orderExpiredBody: ({ order }: { order: string }) => `${order} expired at close.`,
    alertTriggered: ({ symbol, price }: { symbol: string; price: string }) =>
      `${symbol} crossed ${price}`,
    alertTriggeredBody: ({ rule, price }: { rule: string; price: string }) =>
      `Your alert “${rule}” triggered at ${price}.`,
    marketClosesEarly: 'Markets close early today',
    marketClosesEarlyBody: ({ time }: { time: string }) => `Regular session ends at ${time}.`,
  },
  counts: {
    positions: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'position', other: 'positions' })}`,
    openOrders: ({ count, n }: Count) =>
      `${n} open ${plural('en', count, { one: 'order', other: 'orders' })}`,
    watchlist: ({ n }: Count) => `a ${n}-stock watchlist`,
    watchlists: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'watchlist', other: 'watchlists' })}`,
    alerts: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'alert', other: 'alerts' })}`,
    sessions: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'session', other: 'sessions' })}`,
    devices: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'device', other: 'devices' })}`,
    days: ({ count, n }: Count) => `${n} ${plural('en', count, { one: 'day', other: 'days' })}`,
    hours,
    minutes: ({ count, n }: Count) =>
      `${n} ${plural('en', count, { one: 'minute', other: 'minutes' })}`,
  },
  auth: {
    backToMarkets: 'Back to markets',
    valueLine: ({ amount }: Amount) => `Practice trading US stocks with ${amount} virtual cash`,
    or: 'or',
    field: { name: 'Name', email: 'Email', password: 'Password' },
    placeholder: { name: 'Sara Ali', email: 'name@example.com' },
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signUp: {
      title: 'Create your account',
      submit: 'Create account',
      loading: 'Creating account…',
      terms:
        'I agree to the Terms and Privacy Policy. I understand prices are simulated and money is virtual.',
      termsShort: 'I agree to the Terms and understand money is virtual.',
      termsModal: 'I agree to the Terms and Privacy Policy.',
      haveAccount: 'Already have an account?',
      signInLink: 'Sign in',
    },
    terms: {
      page: {
        prefix: 'I agree to the ',
        termsLink: 'Terms',
        and: ' and ',
        privacyLink: 'Privacy Policy',
        suffix: '. I understand prices are simulated and money is virtual.',
      },
      modal: {
        prefix: 'I agree to the ',
        termsLink: 'Terms',
        and: ' and ',
        privacyLink: 'Privacy Policy',
        suffix: '.',
      },
      mobile: {
        prefix: 'I agree to the ',
        termsLink: 'Terms',
        and: ' and ',
        privacyLink: 'Privacy Policy',
        suffix: ' and understand money is virtual.',
      },
    },
    signIn: {
      title: 'Welcome back',
      subtitleMobile: 'Sign in to your practice account',
      forgot: 'Forgot password?',
      forgotShort: 'Forgot?',
      keep: ({ n }: Count) => `Keep me signed in on this device for ${n} days`,
      submit: 'Sign in',
      loading: 'Signing in…',
      newHere: 'New here?',
      createLink: 'Create an account',
      signUpLink: 'Sign up',
      invalidHint: 'Check both and try again, or reset your password.',
    },
    oauth: {
      google: 'Google',
      apple: 'Apple',
      soon: 'Soon',
      comingSoonA11y: ({ provider }: { provider: string }) =>
        `Continue with ${provider} — coming soon`,
    },
    faceId: 'Use Face ID next time · Coming soon',
    faceIdParts: { label: 'Use Face ID next time', soon: 'Coming soon' },
    strength: {
      label: 'Strength',
      levels: { weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong' },
      minLength: ({ n }: N) => `At least ${n} characters`,
      notCommon: 'Not a common password',
      tip: 'Tip: add a number or symbol',
      met: 'Requirement met',
      notMet: 'Requirement not met',
    },
    fieldErrors: {
      NAME_REQUIRED: () => 'Enter your name',
      NAME_TOO_LONG: ({ n }: N) => `Use at most ${n} characters`,
      EMAIL_INVALID: () => 'Enter a full email address, e.g. name@example.com',
      PASSWORD_REQUIRED: () => 'Enter your password',
      PASSWORD_TOO_SHORT: ({ n }: N) => `Use at least ${n} characters`,
      PASSWORD_TOO_LONG: ({ n }: N) => `Use at most ${n} characters`,
      PASSWORD_COMMON: () => 'This password is too common — try a longer phrase',
      PASSWORDS_DIFFER: () => "Passwords don't match",
      TERMS_REQUIRED: () => 'Accept the terms to continue',
      CONFIRMATION_MISMATCH: () => "That doesn't match — type it exactly as shown",
      REASON_LENGTH: ({ n }: N) => `Write a reason of ${n} characters`,
    } satisfies Record<AuthFieldError, (params: N) => string>,
    errors: {
      INVALID_CREDENTIALS: 'Email or password is incorrect.',
      RATE_LIMITED: ({ time }: { time: string }) => `Too many attempts — try again in ${time}.`,
      EMAIL_IN_USE: 'An account with this email already exists. Sign in instead?',
      WEAK_PASSWORD: 'This password is too common — try a longer phrase.',
      TOKEN_EXPIRED: 'This link has expired. We can send a new one.',
      ACCOUNT_SUSPENDED: 'Your account is suspended.',
      SESSION_REVOKED: 'You were signed out on this device.',
      INVALID_CURRENT_PASSWORD: 'Current password is incorrect.',
      CONFIRMATION_MISMATCH: "That doesn't match — type it exactly as shown.",
      CSRF_FAILED: 'Your session needs a refresh. Reload the page and try again.',
      OFFLINE: 'You’re offline. Reconnect to continue.',
      UNKNOWN: 'Something went wrong. Nothing was changed — try again.',
    },
    rateLimitedHint: 'For your security we paused sign-in on this account for a few minutes.',
    retryIn: ({ time }: { time: string }) => `Try again in ${time}`,
    retryReady: 'You can try again now',
    offlineSignIn: 'You’re offline. Reconnect to sign in — we’ll keep what you typed.',
    backToSignIn: 'Back to sign in',
    forgot: {
      title: 'Reset your password',
      body: 'Enter the email you signed up with and we’ll send you a reset link.',
      submit: 'Send reset link',
      sending: 'Sending…',
      sentTitle: 'Check your inbox',
      sentBody: ({ email, duration }: { email: string; duration: string }) =>
        `If an account exists for ${email}, we sent a link to reset your password. It expires in ${duration}.`,
      sentBodyMobile: ({ email, duration }: { email: string; duration: string }) =>
        `If an account exists for ${email}, we sent a reset link. It expires in ${duration}.`,
      openEmail: 'Open email app',
      openMail: 'Open Mail',
      resendIn: ({ time }: { time: string }) => `Didn’t get it? Check spam or resend in ${time}`,
      resendInShort: ({ time }: { time: string }) => `Resend in ${time}`,
      resend: 'Resend link',
    },
    reset: {
      title: 'Choose a new password',
      for: ({ email }: { email: string }) => `For ${email}`,
      new: 'New password',
      confirm: 'Confirm new password',
      confirmShort: 'Confirm password',
      match: 'Passwords match ✓',
      warn: 'Saving signs you out on every other device.',
      submit: 'Save new password',
      loading: 'Saving…',
      doneTitle: 'Password updated',
      doneBody: ({ sessions }: { sessions: string }) =>
        `You’re signed in. Other devices were signed out — ${sessions} ended.`,
      doneBodyMobile: 'You’re signed in on this phone. Other devices were signed out.',
      goHome: 'Go to Home',
      continueHome: 'Continue to Home',
      notice: 'We also emailed you a security notice.',
      expiredTitle: 'This reset link has expired',
      expiredBody: ({ duration }: { duration: string }) =>
        `Reset links work for ${duration} and only once. Request a new one to choose your password.`,
      requestNew: 'Request a new link',
    },
    verify: {
      checking: 'Verifying your email…',
      okTitle: 'Email verified ✓',
      okBody: ({ email }: { email: string }) => `${email} is confirmed. Your account is secured.`,
      continue: 'Continue trading',
      expiredTitle: 'This link has expired',
      expiredBody: ({ duration, email }: { duration: string; email: string }) =>
        `Verification links work for ${duration} and only once. Send a fresh one to ${email}.`,
      expiredBodyNoEmail: ({ duration }: { duration: string }) =>
        `Verification links work for ${duration} and only once. Sign in to send a fresh one.`,
      resend: 'Resend verification email',
      sent: ({ email }: { email: string }) => `We sent a new link to ${email}.`,
    },
  },
  gate: {
    ticket: {
      buyCta: ({ symbol }: SymbolParam) => `Sign up to buy ${symbol}`,
      sellCta: ({ symbol }: SymbolParam) => `Sign up to sell ${symbol}`,
      haveAccount: 'Already have an account? Sign in',
      foot: ({ amount }: Amount) => `Free · ${amount} virtual cash · simulated prices`,
      buyingPower: 'Buying power — sign in',
    },
    title: {
      buy: ({ symbol }: SymbolParam) => `Create an account to buy ${symbol}`,
      sell: ({ symbol }: SymbolParam) => `Create an account to sell ${symbol}`,
      watch: ({ symbol }: SymbolParam) => `Create an account to save ${symbol} to your watchlist`,
      alert: 'Create an account to get price alerts',
      portfolio: 'Create an account to track your portfolio',
      orders: 'Create an account to place and track orders',
      notifications: 'Create an account to get notifications',
    },
    tabs: { signUp: 'Create account', signIn: 'Sign in' },
    modal: {
      sub: ({ amount }: Amount) => `Free · ${amount} practice cash · ready instantly`,
      pwHint: ({ n }: N) => `At least ${n} characters · not a common password`,
      submit: 'Create account & continue',
      signInSubmit: 'Sign in & continue',
      returnNote: ({ amount }: Amount) =>
        `You’ll land back on this order with ${amount} pre-filled.`,
    },
    cta: { createFree: 'Create free account', signIn: 'Sign in' },
    sheet: {
      buySub: ({ n }: N) => `Free, no card, no KYC — about ${n} seconds.`,
      benefitCash: ({ amount }: Amount) => `${amount} practice cash, ready instantly`,
      benefitSync: 'Same account on web and phone',
      benefitOrder: ({ amount, symbol }: Amount & SymbolParam) =>
        `Your ${amount} ${symbol} order stays filled in`,
      watchSub: 'Your watchlist syncs across web and phone.',
      alertSub: ({ symbol }: SymbolParam) =>
        `We’ll notify you when ${symbol} crosses your price — even when the app is closed.`,
    },
    order: {
      footer: ({ amount }: Amount) =>
        `Create a free account to place this order — you’ll get ${amount} in practice cash.`,
      buyingPower: 'Buying power · Sign in to see',
      submit: 'Sign up to buy',
    },
  },
  guest: {
    portfolio: {
      title: ({ amount }: Amount) => `Track a ${amount} practice portfolio`,
      body: 'Create a free account to buy your first shares, see live P&L and keep it in sync on your phone.',
      bodyMobile: 'Create a free account to buy shares and see live P&L on every device.',
    },
    steps: {
      create: {
        title: 'Create an account',
        body: ({ n }: N) => `Takes ${n} seconds · no card, no KYC`,
      },
      cash: {
        title: ({ amount }: Amount) => `Get ${amount} virtual cash`,
        body: 'Ready instantly',
      },
      trade: {
        title: ({ n }: N) => `Trade ${n} US stocks`,
        body: 'Market, limit & stop orders',
      },
    },
    bell: {
      title: 'Get notified when it matters',
      body: 'Order fills, price alerts and market news — in one inbox, on every device.',
      a11y: 'Notifications — sign in to see yours',
    },
    empty: {
      portfolioTitle: 'Your portfolio lives here',
      portfolioBody: ({ amount }: Amount) =>
        `Sign up to get ${amount} in practice cash and track every position.`,
      ordersTitle: 'No orders yet',
      ordersBody: 'Create an account to place market, limit and stop orders.',
      watchlistTitle: 'Save stocks you care about',
      watchlistBody: 'Star any stock to follow it here — synced on web and phone.',
      alertsTitle: 'Price alerts need an account',
      alertsBody: ({ symbol }: SymbolParam) =>
        `Get notified when ${symbol} crosses your price, even with the app closed.`,
      alertsBodyAny: 'Get notified when a stock crosses your price, even with the app closed.',
    },
    starA11y: ({ symbol }: SymbolParam) => `Add ${symbol} to watchlist — requires an account`,
  },
  home: {
    guest: {
      badge: 'Free · no card needed',
      h1: ({ amount }: Amount) => `Start practicing with ${amount}`,
      body: ({ n }: N) =>
        `Trade ${n} US stocks with live simulated prices. Learn order types, track P&L and build a watchlist — without risking a cent.`,
      bodyMobile: ({ n }: N) =>
        `Trade ${n} US stocks with live simulated prices — without risking a cent.`,
      howItWorks: 'How it works',
      stepSignUp: ({ n }: N) => `Sign up in ${n} s`,
      stepCash: ({ amount }: Amount) => `Get ${amount} virtual cash`,
      stepTrade: 'Place your first trade',
      stepsShort: {
        signUp: 'Sign up',
        getCash: ({ amount }: Amount) => `Get ${amount}`,
        trade: 'Trade',
      },
    },
    checklist: {
      title: 'Get started',
      created: 'Account created',
      verify: 'Verify your email',
      resend: 'Resend link',
      firstTrade: 'Make your first trade',
      browse: 'Browse markets',
    },
    newAccount: 'New account · no positions yet',
  },
  verifyBanner: {
    body: ({ email }: { email: string }) =>
      `Verify your email to secure your account — we sent a link to ${email}.`,
    resend: 'Resend',
    sent: 'Link sent',
    dismissA11y: 'Dismiss verify-email message',
  },
  toasts: {
    readyTitle: ({ amount }: Amount) => `Your ${amount} practice account is ready`,
    readyBody: 'Place your first trade — prices are live and simulated.',
    readyBodyHome: ({ name }: { name: string }) =>
      `Welcome, ${name}. Prices are live and simulated.`,
    readyBodyMobile: ({ name }: { name: string }) => `Welcome, ${name} — place your first trade.`,
    trade: 'Trade',
    claimedTitle: 'Your practice portfolio was saved',
    claimedBody: ({ positions, orders }: Record<'positions' | 'orders', string>) =>
      `The ${positions} and ${orders} from this device are now in your account.`,
    claimedTitleMobile: 'Your practice portfolio was saved to your account',
    claimedBodyMobile: ({ positions, orders }: Record<'positions' | 'orders', string>) =>
      `${positions} and ${orders} are now on web too.`,
    savedToWatchlist: 'Saved to Watchlist',
    deletionCanceledTitle: 'Welcome back — your account is no longer being deleted',
    deletionCanceledBody: 'Deletion was canceled because you signed in.',
    signedOut: 'You’re signed out',
    passwordUpdated: 'Password updated',
    profileSaved: 'Profile saved',
    verificationSent: 'Verification email sent',
    otherDevicesSignedOut: ({ sessions }: { sessions: string }) => `Signed out ${sessions}`,
    sessionSignedOut: ({ device }: { device: string }) => `${device} was signed out`,
    accountReset: ({ amount }: Amount) => `Practice account reset to ${amount}`,
    deletionRequested: ({ date }: { date: string }) =>
      `Your account will be deleted on ${date}. Sign in before then to cancel.`,
  },
  discard: {
    title: 'Signing in will replace this device’s practice data',
    body: ({ positions, orders }: Record<'positions' | 'orders', string>) =>
      `${positions} and ${orders} on this device will be discarded and your account’s portfolio loaded. They are never merged.`,
    confirm: 'Sign in anyway',
    cancel: 'Cancel',
    titleMobile: 'Replace this phone’s practice data?',
    subMobile: 'You’re signing in to an existing account.',
    bodyMobile: ({
      positions,
      orders,
      watchlist,
    }: Record<'positions' | 'orders' | 'watchlist', string>) =>
      `On this phone: ${positions}, ${orders} and ${watchlist}. They will be discarded and your account’s portfolio loaded. We never merge two portfolios.`,
  },
  account: {
    sections: {
      profile: 'Profile',
      security: 'Security',
      notifications: 'Notifications',
      appearance: 'Appearance',
      trading: 'Trading',
      danger: 'Danger zone',
    },
    profile: {
      title: 'Profile',
      memberSince: ({ date }: { date: string }) => `Member since ${date}`,
      edit: 'Edit profile',
      editTitle: 'Edit profile',
      nameLabel: 'Name',
      save: 'Save',
      email: 'Email',
      verified: 'Verified',
      unverified: 'Unverified',
      resend: 'Resend',
      accountId: 'Account ID',
      practiceLabel: 'Practice account',
      practice: ({ amount }: Amount) => `${amount} start · Paper`,
    },
    password: {
      title: 'Password',
      lastChanged: ({ count, n }: Count) =>
        `Last changed ${n} ${plural('en', count, { one: 'day', other: 'days' })} ago`,
      changedToday: 'Changed today',
      neverChanged: 'Set when you signed up',
      change: 'Change password',
      current: 'Current password',
      new: 'New password',
      newHint: ({ n }: N) => `Strong · at least ${n} characters`,
      confirm: 'Confirm new password',
      warn: 'Changing your password signs out every other device.',
      warnMobile: 'Other devices will be signed out.',
      submit: 'Update password',
      loading: 'Updating…',
    },
    sessions: {
      title: 'Active sessions',
      titleCount: ({ n }: Count) => `Active sessions · ${n}`,
      sub: ({ devices }: { devices: string }) => `${devices} · IP addresses are partly hidden`,
      signOutOthers: 'Sign out of all other devices',
      thisDevice: 'This device',
      activeNow: 'Active now',
      signOut: 'Sign out',
      meta: ({ ip, time }: Record<'ip' | 'time', string>) => `${ip} · ${time}`,
      deviceWeb: ({ browser, os }: Record<'browser' | 'os', string>) => `${browser} on ${os}`,
      deviceIos: ({ model }: { model: string }) => `Mini Trading for iOS · ${model}`,
      deviceAndroid: ({ model }: { model: string }) => `Mini Trading for Android · ${model}`,
      signOutA11y: ({ device }: { device: string }) => `Sign out ${device}`,
      loadError: "Couldn't load your sessions",
    },
    signOutOthers: {
      title: 'Sign out of all other devices?',
      body: ({ sessions, devices }: Record<'sessions' | 'devices', string>) =>
        `${sessions} will end within a few seconds: ${devices}. Open orders keep working. You stay signed in here.`,
      sub: ({ sessions }: { sessions: string }) => `${sessions} are active.`,
      bodyMobile: ({ devices }: { devices: string }) =>
        `${devices} will be signed out within a few seconds. Open orders keep working.`,
      confirm: ({ devices }: { devices: string }) => `Sign out ${devices}`,
    },
    twoFactor: {
      title: 'Two-factor authentication & passkeys',
      sub: 'Authenticator app, passkeys and Face ID unlock',
      soon: 'Coming soon',
      mobile: 'Two-factor, passkeys & Face ID · Coming soon',
      mobileTitle: 'Two-factor, passkeys & Face ID',
    },
    danger: {
      title: 'Danger zone',
      signOutTitle: 'Sign out',
      signOutBody: 'Only this browser. Your data stays in your account.',
      resetTitle: 'Reset practice account',
      resetBody: ({ amount }: Amount) =>
        `Close all positions, cancel orders, restore ${amount}. History is kept.`,
      resetAction: 'Reset…',
      deleteTitle: 'Delete account',
      deleteBody: ({ days }: { days: string }) =>
        `Permanently deletes your profile, practice portfolio, watchlists and alerts after ${days}.`,
      deleteAction: 'Delete account…',
    },
    deleteDialog: {
      title: 'Delete your account?',
      body: ({
        equity,
        orders,
        watchlists,
        alerts,
        days,
      }: Record<'equity' | 'orders' | 'watchlists' | 'alerts' | 'days', string>) =>
        `Your practice portfolio (${equity}), ${orders}, ${watchlists} and ${alerts} will be deleted. You can cancel within ${days} by signing in.`,
      password: 'Password',
      type: ({ word }: { word: string }) => `Type ${word} to confirm`,
      caseSensitive: 'Case-sensitive',
      confirm: 'Delete account',
      confirmMobile: 'Delete my account',
      deleting: 'Deleting…',
      subMobile: ({ days }: { days: string }) => `This can’t be undone after ${days}.`,
    },
    resetDialog: {
      title: 'Reset practice account?',
      body: ({ positions, orders, amount }: Record<'positions' | 'orders' | 'amount', string>) =>
        `Closes ${positions} at last price, cancels ${orders} and restores ${amount}. Order history is kept.`,
      equityNow: 'Equity now',
      afterReset: 'After reset',
      type: ({ word }: { word: string }) => `Type ${word} to confirm`,
      confirm: 'Reset account',
      resetting: 'Resetting…',
    },
    rows: {
      personalInfo: 'Personal info',
      security: 'Security',
      notifications: 'Notifications',
      appearance: 'Appearance',
      trading: 'Trading',
      tradingSub: 'Confirm large orders',
      language: 'Language',
      signOut: 'Sign out',
      deleteAccount: 'Delete account',
    },
    guest: {
      title: 'Welcome to Mini Trading',
      body: ({ amount }: Amount) =>
        `One free account for web and phone: ${amount} practice cash, watchlists, alerts and order history.`,
      appSettings: 'App settings',
      about: 'About & disclosures',
    },
  },
  suspended: {
    title: 'Your account is suspended',
    body: 'You’ve been signed out on all devices. Your practice portfolio is kept and nothing was deleted.',
    bodyMobile: 'You’ve been signed out on all devices. Your practice portfolio is kept.',
    reasonLabel: 'Reason from our team',
    reason: ({ reason, date }: Record<'reason' | 'date', string>) => `“${reason}” · ${date}`,
    contact: 'Contact support',
    signOut: 'Sign out',
    reference: ({ handle }: { handle: string }) =>
      `Reference ${handle} · You can still browse markets as a guest.`,
    browseGuest: 'Browse as guest',
    reasonCategories: {
      abuse: 'Automated trading scripts',
      fraud: 'Suspicious activity',
      terms: 'Terms of use violation',
      customer_request: 'Suspended at your request',
      other: 'Other',
    } satisfies Record<SuspensionCategory, string>,
  },
  revoked: {
    title: 'You were signed out',
    reasons: {
      signed_out: 'This session was ended from another device. Sign in again to continue.',
      password_changed:
        'Your session ended because your password was changed on another device. If this wasn’t you, reset your password.',
      suspended: 'Your account is suspended.',
      revoked: 'This device was signed out from your account settings.',
      deleted: 'Your account is scheduled for deletion. Sign in again to cancel it.',
      expired: 'Your session expired. Sign in again to continue.',
    },
    reasonsDetailed: {
      signed_out: ({ device, time }: DeviceTime) =>
        `This session was ended from ${device} ${time}. Sign in again to continue.`,
      password_changed: ({ device, time }: DeviceTime) =>
        `Your password was changed on ${device} ${time}, so this session ended. If this wasn’t you, reset your password.`,
      revoked: ({ device, time }: DeviceTime) =>
        `This device was signed out from ${device} ${time}.`,
      deleted: ({ device, time }: DeviceTime) =>
        `Deletion of your account was requested on ${device} ${time}. Sign in again to cancel it.`,
      expired: ({ time }: DeviceTime) => `Your session expired ${time}. Sign in again to continue.`,
    },
    signInAgain: 'Sign in again',
    resetPassword: 'Reset password',
  },
  support: {
    contactLabel: 'Contact support',
    email: 'support@minitrading.dev',
  },
  welcomeNotification: {
    title: ({ name }: { name: string }) => `Welcome to Mini Trading, ${name}`,
    body: ({ amount }: Amount) =>
      `Your ${amount} practice account is ready. Place your first trade whenever you like.`,
  },
  rejections,
  alertIssues,
};

export type Messages = typeof en;
