// ============= TYPE DEFINITIONS =============

export interface Market {
  id: string;
  question?: string;
  name?: string;
  description?: string;
  endDate: string | Date;
  volume?: number;
  volume24hr?: number;
  liquidity?: number;
  outcomePrices?: [number, number];
  priceChange24hr?: number;
  category?: string;
  recentTrades?: Trade[];
  traders?: Trader[];
}

export interface Trade {
  id: string;
  marketId: string;
  side: 'YES' | 'NO';
  size: number;
  price: number;
  timestamp: number;
  outcome?: string;
}

export interface Trader {
  address: string;
  createdAt?: string | Date;
  totalTrades?: number;
  currentPosition?: number;
  side?: 'YES' | 'NO';
}

export interface EdgeOpportunity {
  marketId: string;
  marketName: string;
  marketDescription?: string;
  edgeScore: number;
  reason: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  volume24h?: number;
  liquidity: number;
  suggestedSide: 'YES' | 'NO' | 'BOTH';
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
  alerts?: Alert[];
}

export interface Alert {
  type: 'whale' | 'fresh_wallet' | 'volume_spike';
  severity: 'high' | 'medium' | 'low';
  message: string;
  icon: string;
}

export interface Edge {
  score: number;
  reason: string;
  side: 'YES' | 'NO' | 'BOTH';
  confidence: 'low' | 'medium' | 'high';
  alertType?: 'whale' | 'fresh_wallet' | 'volume_spike';
  whaleData?: WhaleData;
  freshWalletData?: FreshWalletData;
  volumeData?: VolumeData;
}

export interface WhaleData {
  tradeCount: number;
  totalSize: number;
  avgSize: number;
  direction: 'YES' | 'NO';
}

export interface FreshWalletData {
  walletCount: number;
  totalPosition: number;
  percentageOfMarket: number;
  direction: 'YES' | 'NO';
}

export interface VolumeData {
  volume24h: number;
  volumePrevious: number;
  spikeRatio: number;
  priceChange24h?: number;
}

export interface WhaleDirection {
  side: 'YES' | 'NO';
  confidence: number;
  yesBets: number;
  noBets: number;
  yesVolume: number;
  noVolume: number;
}

export interface NewsItem {
  title: string;
  link: string;
  contentSnippet?: string;
  description?: string;
  pubDate: string;
  content?: string;
}

export interface TradeRecord {
  id?: number;
  market_id: string;
  market_name: string;
  side: 'YES' | 'NO';
  size: number;
  price: number;
  edge?: number;
  status: 'pending' | 'executed' | 'closed' | 'failed';
  executed_at?: number;
  closed_at?: number;
  pnl?: number;
  notes?: string;
  created_at?: number;
}

export interface PnLSummary {
  total_trades: number;
  executed_trades: number;
  total_pnl: number;
  avg_pnl: number;
  max_pnl: number;
  min_pnl: number;
  winning_trades: number;
  losing_trades: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
}

export interface WebSocketMessage {
  type: 'market_update' | 'edge_update' | 'trade_update' | 'news_update';
  data: any;
  timestamp: number;
}

export interface EdgeDetectorConfig {
  minEdgeThreshold: number;
  whaleThreshold: number;
  volumeSpikeThreshold: number;
  freshWalletAge?: number;
  freshWalletTrades?: number;
}

export interface TradeExecutorConfig {
  autoTradeEnabled: boolean;
  maxTradeSize: number;
  privateKey?: string;
}

