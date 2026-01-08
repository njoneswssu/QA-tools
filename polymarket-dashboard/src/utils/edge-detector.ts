import {
    Market,
    NewsItem,
    EdgeOpportunity,
    Edge,
    WhaleDirection,
    EdgeDetectorConfig,
    Alert
} from '../types';

export class EdgeDetector {
    private minEdgeThreshold: number;
    private whaleThreshold: number;
    private volumeSpikeThreshold: number;

    constructor(config?: Partial<EdgeDetectorConfig>) {
        this.minEdgeThreshold = config?.minEdgeThreshold || parseFloat(process.env.MIN_EDGE_THRESHOLD || '0.05');
        this.whaleThreshold = config?.whaleThreshold || parseFloat(process.env.WHALE_BET_THRESHOLD || '10000');
        this.volumeSpikeThreshold = config?.volumeSpikeThreshold || parseFloat(process.env.VOLUME_SPIKE_THRESHOLD || '3');
    }

    /**
     * Find edge opportunities in markets
     */
    async findEdges(markets: Market[], news: NewsItem[]): Promise<EdgeOpportunity[]> {
        const opportunities: EdgeOpportunity[] = [];

        for (const market of markets) {
            const edges: Edge[] = [];

            // Run all edge detection algorithms
            const volumeEdge = this.detectVolumeEdge(market);
            if (volumeEdge) edges.push(volumeEdge);

            const spreadEdge = this.detectSpreadEdge(market);
            if (spreadEdge) edges.push(spreadEdge);

            const newsEdge = this.detectNewsEdge(market, news);
            if (newsEdge) edges.push(newsEdge);

            const arbEdge = this.detectArbitrageEdge(market);
            if (arbEdge) edges.push(arbEdge);

            const inefficiencyEdge = this.detectInefficiency(market);
            if (inefficiencyEdge) edges.push(inefficiencyEdge);

            const whaleEdge = await this.detectWhaleActivity(market);
            if (whaleEdge) edges.push(whaleEdge);

            const freshWalletEdge = await this.detectFreshWallets(market);
            if (freshWalletEdge) edges.push(freshWalletEdge);

            const volumeSpikeEdge = this.detectVolumeSpikeEdge(market);
            if (volumeSpikeEdge) edges.push(volumeSpikeEdge);

            // Combine edges and create opportunity
            if (edges.length > 0) {
                const maxEdge = edges.reduce((max, edge) => 
                    edge.score > max.score ? edge : max
                );

                if (maxEdge.score >= this.minEdgeThreshold) {
                    opportunities.push({
                        marketId: market.id,
                        marketName: market.question || market.name || 'Unknown',
                        marketDescription: market.description,
                        edgeScore: maxEdge.score,
                        reason: maxEdge.reason,
                        yesPrice: market.outcomePrices?.[0] || 0.5,
                        noPrice: market.outcomePrices?.[1] || 0.5,
                        volume: market.volume || 0,
                        volume24h: market.volume24hr || 0,
                        liquidity: market.liquidity || 0,
                        suggestedSide: maxEdge.side,
                        confidence: maxEdge.confidence,
                        factors: edges.map(e => e.reason),
                        alerts: this.generateAlerts(edges)
                    });
                }
            }
        }

        return opportunities.sort((a, b) => b.edgeScore - a.edgeScore);
    }

    /**
     * 🐋 Detect whale activity
     */
    private async detectWhaleActivity(market: Market): Promise<Edge | null> {
        try {
            const trades = market.recentTrades || [];
            if (trades.length === 0) return null;

            const avgTradeSize = trades.reduce((sum, t) => sum + (t.size || 0), 0) / trades.length;
            const whaleTrades = trades.filter(t => 
                t.size >= this.whaleThreshold && t.size >= avgTradeSize * 5
            );

            if (whaleTrades.length > 0) {
                const totalWhaleSize = whaleTrades.reduce((sum, t) => sum + t.size, 0);
                const whaleDirection = this.analyzeWhaleDirection(whaleTrades);
                
                if (whaleDirection.confidence > 0.7) {
                    const edge = Math.min(whaleDirection.confidence * 0.15, 0.15);
                    
                    return {
                        score: edge,
                        reason: `🐋 WHALE ALERT: ${whaleTrades.length} large bet(s) totaling $${totalWhaleSize.toLocaleString()} on ${whaleDirection.side}`,
                        side: whaleDirection.side,
                        confidence: 'high',
                        alertType: 'whale',
                        whaleData: {
                            tradeCount: whaleTrades.length,
                            totalSize: totalWhaleSize,
                            avgSize: totalWhaleSize / whaleTrades.length,
                            direction: whaleDirection.side
                        }
                    };
                }
            }
        } catch (error) {
            console.error('Error detecting whale activity:', error);
        }
        
        return null;
    }

    /**
     * 🆕 Detect fresh wallet activity
     */
    private async detectFreshWallets(market: Market): Promise<Edge | null> {
        try {
            const traders = market.traders || [];
            if (traders.length === 0) return null;

            const freshWallets = traders.filter(trader => {
                const accountAge = this.calculateAccountAge(trader.createdAt);
                const tradeCount = trader.totalTrades || 0;
                return (accountAge < 30 || tradeCount < 10) && (trader.currentPosition || 0) > 0;
            });

            if (freshWallets.length > 0) {
                const freshWalletVolume = freshWallets.reduce((sum, w) => 
                    sum + (w.currentPosition || 0), 0
                );
                
                const totalMarketVolume = market.volume || 1;
                const freshWalletPercentage = freshWalletVolume / totalMarketVolume;

                if (freshWalletPercentage > 0.15) {
                    const freshWalletDirection = this.analyzeFreshWalletDirection(freshWallets);
                    
                    if (freshWalletDirection.confidence > 0.6) {
                        const edge = Math.min(freshWalletPercentage * 0.5, 0.12);
                        
                        return {
                            score: edge,
                            reason: `🆕 FRESH WALLET ALERT: ${freshWallets.length} new wallet(s) holding ${(freshWalletPercentage * 100).toFixed(1)}% of volume on ${freshWalletDirection.side}`,
                            side: freshWalletDirection.side,
                            confidence: 'medium',
                            alertType: 'fresh_wallet',
                            freshWalletData: {
                                walletCount: freshWallets.length,
                                totalPosition: freshWalletVolume,
                                percentageOfMarket: freshWalletPercentage,
                                direction: freshWalletDirection.side
                            }
                        };
                    }
                }
            }
        } catch (error) {
            console.error('Error detecting fresh wallets:', error);
        }
        
        return null;
    }

    /**
     * 📊 Detect volume spike
     */
    private detectVolumeSpikeEdge(market: Market): Edge | null {
        try {
            const volume24h = market.volume24hr || 0;
            const volumeTotal = market.volume || 1;
            const volumePrevious = volumeTotal - volume24h;
            
            if (volumePrevious <= 0) return null;

            const volumeRatio = volume24h / volumePrevious;

            if (volumeRatio >= this.volumeSpikeThreshold) {
                const yesPrice = market.outcomePrices?.[0] || 0.5;
                const priceChange24h = market.priceChange24hr || 0;
                const priceMovementSignificant = Math.abs(priceChange24h) > 0.1;
                
                let direction: 'YES' | 'NO' = 'YES';
                if (priceMovementSignificant) {
                    direction = priceChange24h > 0 ? 'YES' : 'NO';
                } else {
                    direction = yesPrice < 0.5 ? 'YES' : 'NO';
                }
                
                const edge = Math.min((volumeRatio - 1) * 0.03, 0.15);
                
                return {
                    score: edge,
                    reason: `📊 VOLUME SPIKE: ${volumeRatio.toFixed(1)}x normal volume in 24h (${this.formatVolume(volume24h)})`,
                    side: direction,
                    confidence: priceMovementSignificant ? 'high' : 'medium',
                    alertType: 'volume_spike',
                    volumeData: {
                        volume24h,
                        volumePrevious,
                        spikeRatio: volumeRatio,
                        priceChange24h
                    }
                };
            }
        } catch (error) {
            console.error('Error detecting volume spike:', error);
        }
        
        return null;
    }

    /**
     * Detect edge based on low volume (thin markets)
     */
    private detectVolumeEdge(market: Market): Edge | null {
        const volume = market.volume || 0;
        
        if (volume < 10000) {
            const yesPrice = market.outcomePrices?.[0] || 0.5;
            
            if (yesPrice < 0.2 || yesPrice > 0.8) {
                const edge = Math.abs(0.5 - yesPrice) * 0.3;
                
                return {
                    score: edge,
                    reason: `Low volume market ($${volume.toFixed(0)}) with extreme pricing`,
                    side: yesPrice < 0.3 ? 'YES' : 'NO',
                    confidence: 'low'
                };
            }
        }
        
        return null;
    }

    /**
     * Detect edge based on wide bid-ask spread
     */
    private detectSpreadEdge(market: Market): Edge | null {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const noPrice = market.outcomePrices?.[1] || 0.5;
        
        const totalPrice = yesPrice + noPrice;
        const deviation = Math.abs(1.0 - totalPrice);
        
        if (deviation > 0.15) {
            return {
                score: deviation * 0.5,
                reason: `Wide spread detected (${(deviation * 100).toFixed(1)}% deviation from fair pricing)`,
                side: yesPrice < noPrice ? 'YES' : 'NO',
                confidence: 'medium'
            };
        }
        
        return null;
    }

    /**
     * Detect edge based on news correlation
     */
    private detectNewsEdge(market: Market, news: NewsItem[]): Edge | null {
        const marketName = (market.question || market.name || '').toLowerCase();
        const marketDesc = (market.description || '').toLowerCase();
        const keywords = this.extractKeywords(marketName + ' ' + marketDesc);
        
        let relevantNews = 0;
        let sentimentScore = 0;
        
        for (const item of news.slice(0, 20)) {
            const newsText = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
            const matches = keywords.filter(kw => newsText.includes(kw));
            
            if (matches.length >= 2) {
                relevantNews++;
                
                const posWords = ['win', 'success', 'growth', 'up', 'rise', 'gain', 'positive', 'victory'];
                const negWords = ['lose', 'fail', 'decline', 'down', 'fall', 'drop', 'negative', 'defeat'];
                
                const posCount = posWords.filter(w => newsText.includes(w)).length;
                const negCount = negWords.filter(w => newsText.includes(w)).length;
                
                sentimentScore += (posCount - negCount);
            }
        }
        
        if (relevantNews >= 2) {
            const yesPrice = market.outcomePrices?.[0] || 0.5;
            const priceVsSentiment = (sentimentScore > 0 && yesPrice < 0.5) || 
                                     (sentimentScore < 0 && yesPrice > 0.5);
            
            if (priceVsSentiment) {
                const edge = Math.min(Math.abs(sentimentScore) * 0.03, 0.15);
                
                return {
                    score: edge,
                    reason: `News correlation: ${relevantNews} recent articles, sentiment ${sentimentScore > 0 ? 'positive' : 'negative'}`,
                    side: sentimentScore > 0 ? 'YES' : 'NO',
                    confidence: 'high'
                };
            }
        }
        
        return null;
    }

    /**
     * Detect arbitrage opportunities
     */
    private detectArbitrageEdge(market: Market): Edge | null {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const noPrice = market.outcomePrices?.[1] || 0.5;
        const totalPrice = yesPrice + noPrice;
        
        if (totalPrice < 0.95) {
            return {
                score: (0.95 - totalPrice),
                reason: `Arbitrage opportunity: Buy both outcomes for ${(totalPrice * 100).toFixed(1)}¢`,
                side: 'BOTH',
                confidence: 'high'
            };
        }
        
        return null;
    }

    /**
     * Detect market inefficiency
     */
    private detectInefficiency(market: Market): Edge | null {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const volume = market.volume || 0;
        const liquidity = market.liquidity || 0;
        
        if (volume > 1000 && liquidity < 5000) {
            const endDate = new Date(market.endDate);
            const now = new Date();
            const daysUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysUntilEnd < 30 && (yesPrice < 0.15 || yesPrice > 0.85)) {
                const edge = Math.abs(0.5 - yesPrice) * 0.2;
                
                return {
                    score: edge,
                    reason: `Niche market inefficiency: Low liquidity, ${daysUntilEnd.toFixed(0)} days to resolution`,
                    side: yesPrice > 0.5 ? 'YES' : 'NO',
                    confidence: 'medium'
                };
            }
        }
        
        return null;
    }

    // Helper methods
    private analyzeWhaleDirection(whaleTrades: any[]): WhaleDirection {
        let yesBets = 0, noBets = 0, yesVolume = 0, noVolume = 0;

        whaleTrades.forEach(trade => {
            if (trade.side === 'YES' || trade.outcome === 'YES') {
                yesBets++;
                yesVolume += trade.size || 0;
            } else {
                noBets++;
                noVolume += trade.size || 0;
            }
        });

        const totalVolume = yesVolume + noVolume;
        const dominantSide = yesVolume > noVolume ? 'YES' : 'NO';
        const confidence = Math.abs(yesVolume - noVolume) / totalVolume;

        return { side: dominantSide, confidence, yesBets, noBets, yesVolume, noVolume };
    }

    private analyzeFreshWalletDirection(freshWallets: any[]): WhaleDirection {
        let yesPositions = 0, noPositions = 0, yesVolume = 0, noVolume = 0;

        freshWallets.forEach(wallet => {
            const position = wallet.currentPosition || 0;
            if (wallet.side === 'YES') {
                yesPositions++;
                yesVolume += position;
            } else {
                noPositions++;
                noVolume += position;
            }
        });

        const totalVolume = yesVolume + noVolume;
        const dominantSide = yesVolume > noVolume ? 'YES' : 'NO';
        const confidence = totalVolume > 0 ? Math.abs(yesVolume - noVolume) / totalVolume : 0;

        return { side: dominantSide, confidence, yesBets: yesPositions, noBets: noPositions, yesVolume, noVolume };
    }

    private calculateAccountAge(createdAt?: string | Date): number {
        if (!createdAt) return 999;
        
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    private generateAlerts(edges: Edge[]): Alert[] {
        const alerts: Alert[] = [];
        
        edges.forEach(edge => {
            if (edge.alertType === 'whale') {
                alerts.push({
                    type: 'whale',
                    severity: 'high',
                    message: edge.reason,
                    icon: '🐋'
                });
            }
            
            if (edge.alertType === 'fresh_wallet') {
                alerts.push({
                    type: 'fresh_wallet',
                    severity: 'medium',
                    message: edge.reason,
                    icon: '🆕'
                });
            }
            
            if (edge.alertType === 'volume_spike') {
                alerts.push({
                    type: 'volume_spike',
                    severity: edge.confidence === 'high' ? 'high' : 'medium',
                    message: edge.reason,
                    icon: '📊'
                });
            }
        });
        
        return alerts;
    }

    private formatVolume(volume: number): string {
        if (volume >= 1000000) {
            return `$${(volume / 1000000).toFixed(2)}M`;
        } else if (volume >= 1000) {
            return `$${(volume / 1000).toFixed(1)}k`;
        } else {
            return `$${volume.toFixed(0)}`;
        }
    }

    private extractKeywords(text: string): string[] {
        const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'will', 'be', 'is', 'are', 'was', 'were'];
        const words = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.includes(w));
        
        return [...new Set(words)];
    }
}

