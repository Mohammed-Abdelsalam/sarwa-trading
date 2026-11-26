import { useLocalSearchParams } from 'expo-router';

import { StockDetailScreen } from '../../features/stock-detail/stock-detail-screen';

export default function StockRoute() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  return <StockDetailScreen symbol={symbol.toUpperCase()} />;
}
