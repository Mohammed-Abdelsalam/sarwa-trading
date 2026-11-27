import { useLocalSearchParams } from 'expo-router';

import { NotFoundScreen } from '../../components/layout/route-fallbacks';
import { StockDetailScreen } from '../../features/stock-detail/stock-detail-screen';
import { parseSymbol } from '../../lib/navigation';

export default function StockRoute() {
  const symbol = parseSymbol(useLocalSearchParams<{ symbol?: string | string[] }>().symbol);
  return symbol ? <StockDetailScreen symbol={symbol} /> : <NotFoundScreen />;
}
