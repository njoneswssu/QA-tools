class EdgeDetector {
    constructor() {
        this.minEdgeThreshold = parseFloat(process.env.MIN_EDGE_THRESHOLD || 0.05);
        this.whaleThreshold = parseFloat(process.env.WHALE_BET_THRESHOLD || 10000); // $10k+ bets
        this.volumeSpikeThreshold = parseFloat(process.env.VOLUME_SPIKE_THRESHOLD || 3); // 3x average
    }

    /**
     * Find edge opportunities in markets
     * @param {Array} markets - List of Polymarket markets
     * @param {Array} news - List of news items
     * @returns {Array} Edge opportunities
     */
    async findEdges(markets, news) {
        const opportunities = [];

        for (const market of markets) {
            const edges = [];

            // 1. Volume-based edge detection
            const volumeEdge = this.detectVolumeEdge(market);
            if (volumeEdge) edges.push(volumeEdge);

            // 2. Spread-based edge detection
            const spreadEdge = this.detectSpreadEdge(market);
            if (spreadEdge) edges.push(spreadEdge);

            // 3. News correlation edge
            const newsEdge = this.detectNewsEdge(market, news);
            if (newsEdge) edges.push(newsEdge);

            // 4. Probability arbitrage
            const arbEdge = this.detectArbitrageEdge(market);
            if (arbEdge) edges.push(arbEdge);

            // 5. Market inefficiency detection
            const inefficiencyEdge = this.detectInefficiency(market);
            if (inefficiencyEdge) edges.push(inefficiencyEdge);

            // 6. 🐋 WHALE ACTIVITY DETECTION (NEW)
            const whaleEdge = await this.detectWhaleActivity(market);
            if (whaleEdge) edges.push(whaleEdge);

            // 7. 🆕 FRESH WALLET DETECTION (NEW)
            const freshWalletEdge = await this.detectFreshWallets(market);
            if (freshWalletEdge) edges.push(freshWalletEdge);

            // 8. 📊 VOLUME SPIKE DETECTION (NEW)
            const volumeSpikeEdge = this.detectVolumeSpikeEdge(market);
            if (volumeSpikeEdge) edges.push(volumeSpikeEdge);

            // Combine edges and create opportunity
            if (edges.length > 0) {
                const maxEdge = edges.reduce((max, edge) => 
                    edge.score > max.score ? edge : max
                , edges[0]);

                if (maxEdge.score >= this.minEdgeThreshold) {
                    opportunities.push({
                        marketId: market.id,
                        marketName: market.question || market.name,
                        marketDescription: market.description,
                        edgeScore: maxEdge.score,
                        reason: maxEdge.reason,
                        yesPrice: market.outcomePrices?.[0] || 0.5,
                        noPrice: market.outcomePrices?.[1] || 0.5,
                        volume: market.volume || 0,
                        volume24h: market.volume24hr || 0,
                        liquidity: market.liquidity || 0,
                        suggestedSide: maxEdge.side,
                        confidence: maxEdge.confidence || 'medium',
                        factors: edges.map(e => e.reason),
                        alerts: this.generateAlerts(edges)
                    });
                }
            }
        }

        // Sort by edge score descending
        return opportunities.sort((a, b) => b.edgeScore - a.edgeScore);
    }

    /**
     * 🐋 DETECT WHALE ACTIVITY
     * Looks for abnormally large bets that may indicate insider knowledge
     */
    async detectWhaleActivity(market) {
        try {
            // Get recent trades for this market
            const trades = market.recentTrades || [];
            
            if (trades.length === 0) return null;

            // Calculate average trade size
            const avgTradeSize = trades.reduce((sum, t) => sum + (t.size || 0), 0) / trades.length;
            
            // Find whale trades (significantly larger than average)
            const whaleTrades = trades.filter(t => 
                t.size >= this.whaleThreshold && t.size >= avgTradeSize * 5
            );

            if (whaleTrades.length > 0) {
                const totalWhaleSize = whaleTrades.reduce((sum, t) => sum + t.size, 0);
                const whaleDirection = this.analyzeWhaleDirection(whaleTrades);
                
                // Check if whales are all betting one direction
                if (whaleDirection.confidence > 0.7) {
                    const edge = Math.min(whaleDirection.confidence * 0.15, 0.15); // Max 15% edge
                    
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
            console.error('Error detecting whale activity:', error.message);
        }
        
        return null;
    }

    /**
     * 🆕 DETECT FRESH WALLET ACTIVITY
     * New wallets with large positions may indicate insider trading
     */
    async detectFreshWallets(market) {
        try {
            const trades = market.recentTrades || [];
            const traders = market.traders || [];
            
            if (traders.length === 0) return null;

            // Identify fresh wallets (created recently, few trades)
            const freshWallets = traders.filter(trader => {
                const accountAge = this.calculateAccountAge(trader.createdAt);
                const tradeCount = trader.totalTrades || 0;
                
                // Fresh = less than 30 days old OR less than 10 trades
                return (accountAge < 30 || tradeCount < 10) && trader.currentPosition > 0;
            });

            if (freshWallets.length > 0) {
                // Calculate total fresh wallet exposure
                const freshWalletVolume = freshWallets.reduce((sum, w) => 
                    sum + (w.currentPosition || 0), 0
                );
                
                // Check if fresh wallets have significant position
                const totalMarketVolume = market.volume || 1;
                const freshWalletPercentage = freshWalletVolume / totalMarketVolume;

                if (freshWalletPercentage > 0.15) { // Fresh wallets control >15% of market
                    const freshWalletDirection = this.analyzeFreshWalletDirection(freshWallets);
                    
                    if (freshWalletDirection.confidence > 0.6) {
                        const edge = Math.min(freshWalletPercentage * 0.5, 0.12); // Max 12% edge
                        
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
            console.error('Error detecting fresh wallets:', error.message);
        }
        
        return null;
    }

    /**
     * 📊 DETECT VOLUME SPIKE
     * Sudden volume increases may indicate news or insider knowledge
     */
    detectVolumeSpikeEdge(market) {
        try {
            const volume24h = market.volume24hr || 0;
            const volumeTotal = market.volume || 1;
            const volumePrevious = volumeTotal - volume24h;
            
            if (volumePrevious <= 0) return null;

            // Calculate volume spike ratio
            const volumeRatio = volume24h / volumePrevious;

            // Check for abnormal volume spike
            if (volumeRatio >= this.volumeSpikeThreshold) {
                const yesPrice = market.outcomePrices?.[0] || 0.5;
                const priceChange24h = market.priceChange24hr || 0;
                
                // Determine if spike correlates with price movement
                const priceMovementSignificant = Math.abs(priceChange24h) > 0.1;
                
                let direction = 'YES';
                if (priceMovementSignificant) {
                    direction = priceChange24h > 0 ? 'YES' : 'NO';
                } else {
                    // If no significant price movement despite volume spike, may indicate accumulation
                    direction = yesPrice < 0.5 ? 'YES' : 'NO';
                }
                
                const edge = Math.min((volumeRatio - 1) * 0.03, 0.15); // Max 15% edge
                
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
            console.error('Error detecting volume spike:', error.message);
        }
        
        return null;
    }

    /**
     * Analyze direction of whale trades
     */
    analyzeWhaleDirection(whaleTrades) {
        let yesBets = 0;
        let noBets = 0;
        let yesVolume = 0;
        let noVolume = 0;

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

        return {
            side: dominantSide,
            confidence,
            yesBets,
            noBets,
            yesVolume,
            noVolume
        };
    }

    /**
     * Analyze direction of fresh wallet positions
     */
    analyzeFreshWalletDirection(freshWallets) {
        let yesPositions = 0;
        let noPositions = 0;
        let yesVolume = 0;
        let noVolume = 0;

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

        return {
            side: dominantSide,
            confidence,
            yesPositions,
            noPositions,
            yesVolume,
            noVolume
        };
    }

    /**
     * Calculate account age in days
     */
    calculateAccountAge(createdAt) {
        if (!createdAt) return 999; // Unknown age, treat as old
        
        const now = new Date();
        const created = new Date(createdAt);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * Generate alert messages based on detected edges
     */
    generateAlerts(edges) {
        const alerts = [];
        
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

    /**
     * Format volume for display
     */
    formatVolume(volume) {
        if (volume >= 1000000) {
            return `$${(volume / 1000000).toFixed(2)}M`;
        } else if (volume >= 1000) {
            return `$${(volume / 1000).toFixed(1)}k`;
        } else {
            return `$${volume.toFixed(0)}`;
        }
    }

    /**
     * Detect edge based on low volume (thin markets)
     */
    detectVolumeEdge(market) {
        const volume = market.volume || 0;
        
        // Markets with low volume (<$10k) may be mispriced
        if (volume < 10000) {
            const yesPrice = market.outcomePrices?.[0] || 0.5;
            const noPrice = market.outcomePrices?.[1] || 0.5;
            
            // Check if prices are extreme (could indicate inefficiency)
            if (yesPrice < 0.2 || yesPrice > 0.8) {
                const edge = Math.abs(0.5 - yesPrice) * 0.3; // Conservative edge estimate
                
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
    detectSpreadEdge(market) {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const noPrice = market.outcomePrices?.[1] || 0.5;
        
        // In efficient markets, yes + no should equal ~1.0
        // Deviation indicates potential edge
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
    detectNewsEdge(market, news) {
        const marketName = (market.question || market.name || '').toLowerCase();
        const marketDesc = (market.description || '').toLowerCase();
        
        // Extract key terms from market
        const keywords = this.extractKeywords(marketName + ' ' + marketDesc);
        
        // Find related news
        let relevantNews = 0;
        let sentimentScore = 0;
        
        for (const item of news.slice(0, 20)) { // Check recent news only
            const newsText = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
            
            // Check for keyword matches
            const matches = keywords.filter(kw => newsText.includes(kw));
            
            if (matches.length >= 2) {
                relevantNews++;
                
                // Simple sentiment analysis
                const posWords = ['win', 'success', 'growth', 'up', 'rise', 'gain', 'positive', 'victory'];
                const negWords = ['lose', 'fail', 'decline', 'down', 'fall', 'drop', 'negative', 'defeat'];
                
                const posCount = posWords.filter(w => newsText.includes(w)).length;
                const negCount = negWords.filter(w => newsText.includes(w)).length;
                
                sentimentScore += (posCount - negCount);
            }
        }
        
        if (relevantNews >= 2) {
            const yesPrice = market.outcomePrices?.[0] || 0.5;
            
            // If news is positive but price is low, or news is negative but price is high
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
    detectArbitrageEdge(market) {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const noPrice = market.outcomePrices?.[1] || 0.5;
        
        // Pure arbitrage: if yes + no < 0.95, you can buy both and guarantee profit
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
    detectInefficiency(market) {
        const yesPrice = market.outcomePrices?.[0] || 0.5;
        const volume = market.volume || 0;
        const liquidity = market.liquidity || 0;
        
        // Niche markets with low liquidity but reasonable volume
        if (volume > 1000 && liquidity < 5000) {
            // Check if market is about to resolve soon
            const endDate = new Date(market.endDate);
            const now = new Date();
            const daysUntilEnd = (endDate - now) / (1000 * 60 * 60 * 24);
            
            // Markets close to resolution with extreme prices may not move
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

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'will', 'be', 'is', 'are', 'was', 'were'];
        const words = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.includes(w));
        
        return [...new Set(words)]; // Remove duplicates
    }
}

module.exports = { EdgeDetector };
