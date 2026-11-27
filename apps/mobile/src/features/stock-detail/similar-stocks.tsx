import { Link } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';
import { changePct, direction, formatPct, formatStockLabel, useQuote } from '@sarwa/core';

import { ChangePill } from '../../components/trading/change-pill';
import { PriceFlash } from '../../components/trading/price-flash';
import { Sparkline } from '../../components/trading/sparkline';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';

function SimilarCard({ stock }: { stock: StockWithQuote }) {
  const copy = useCopy();
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);
  return (
    <Link href={`/stocks/${stock.symbol}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={formatStockLabel(copy, {
          symbol: stock.symbol,
          name: stock.name,
          quote,
        })}
        className="w-40 gap-2.5 rounded-lg border border-border bg-surface px-4 py-3.5 active:bg-surface-3"
      >
        <View className="flex-row items-center gap-2.5">
          <StockAvatar symbol={stock.symbol} sector={stock.sector} />
          <View className="flex-1">
            <Text variant="symbol">{stock.symbol}</Text>
            <Text variant="caption" className="text-fg-3" numberOfLines={1}>
              {stock.name}
            </Text>
          </View>
        </View>
        <Sparkline values={stock.sparkline} direction={direction(pct)} width={126} height={32} />
        <View className="gap-1">
          <PriceFlash price={quote.price} />
          <ChangePill value={pct} label={formatPct(copy.f, pct)} />
        </View>
      </Pressable>
    </Link>
  );
}

export function SimilarStocks({ title, stocks }: { title: string; stocks: StockWithQuote[] }) {
  if (stocks.length === 0) return null;
  return (
    <View className="gap-3 pt-6">
      <Text variant="h3" accessibilityRole="header" className="px-5">
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-5"
      >
        {stocks.map((stock) => (
          <SimilarCard key={stock.symbol} stock={stock} />
        ))}
      </ScrollView>
    </View>
  );
}
