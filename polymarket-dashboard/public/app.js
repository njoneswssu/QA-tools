// API Base URL
const API_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;

console.log('🚀 App.js loaded');
console.log('API_URL:', API_URL);
console.log('WS_URL:', WS_URL);

// State
let markets = [];
let edgeOpportunities = [];
let trades = [];
let newsItems = [];
let selectedMarket = null;
let selectedSide = 'YES';
let pnlChart = null;
let tradesChart = null;
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded - Initializing...');
    try {
        initializeEventListeners();
        console.log('✅ Event listeners initialized');
        
        connectWebSocket();
        console.log('✅ WebSocket connection initiated');
        
        loadAllData();
        console.log('✅ Data loading initiated');
        
        // Auto-refresh news every 10 minutes
        setInterval(loadNews, 10 * 60 * 1000);
        
        // Auto-refresh balance every 30 seconds
        setInterval(loadBalance, 30 * 1000);
        
        console.log('✅ Auto-refresh timers set');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
});

// WebSocket Connection
function connectWebSocket() {
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            reconnectAttempts = 0;
            updateStatus('connected');
            showNotification('Connected to real-time updates', 'success');
        };
        
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus('error');
        };
        
        ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            updateStatus('disconnected');
            
            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(connectWebSocket, delay);
            } else {
                showNotification('Connection lost. Please refresh the page.', 'error');
            }
        };
    } catch (error) {
        console.error('Error connecting WebSocket:', error);
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(message) {
    const { type, data, timestamp } = message;
    
    switch(type) {
        case 'market_update':
            if (Array.isArray(data) && data.length > 0) {
                markets = data;
                renderMarkets(markets);
                console.log('📊 Markets updated in real-time');
            }
            break;
            
        case 'edge_update':
            if (Array.isArray(data) && data.length > 0) {
                edgeOpportunities = data;
                renderEdgeOpportunities();
                updateEdgeStats();
                
                // Show notification for new high-edge opportunities
                const highEdgeOpps = data.filter(o => o.edgeScore > 0.1 && o.confidence === 'high');
                if (highEdgeOpps.length > 0) {
                    showNotification(`🎯 ${highEdgeOpps.length} new high-edge opportunities detected!`, 'info');
                }
                console.log('🎯 Edge opportunities updated in real-time');
            }
            break;
            
        case 'trade_update':
            loadTrades();
            showNotification(`Trade ${data.status}`, data.status === 'executed' ? 'success' : 'info');
            console.log('💼 Trade updated in real-time');
            break;
            
        case 'news_update':
            if (Array.isArray(data) && data.length > 0) {
                newsItems = data;
                renderNews();
                console.log('📰 News updated in real-time');
            }
            break;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Check if notification container exists, if not create it
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        padding: 1rem 1.5rem;
        margin-bottom: 0.5rem;
        border-radius: 8px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Remove on click
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    };
}

// Event Listeners
function initializeEventListeners() {
    // Refresh buttons
    document.getElementById('refresh-all')?.addEventListener('click', loadAllData);
    document.getElementById('refresh-edge')?.addEventListener('click', loadEdgeOpportunities);
    document.getElementById('refresh-news')?.addEventListener('click', loadNews);

    // Market search
    document.getElementById('market-search')?.addEventListener('input', filterMarkets);
    document.getElementById('category-filter')?.addEventListener('change', filterMarkets);

    // Trade status filter
    document.getElementById('trade-status-filter')?.addEventListener('change', filterTrades);

    // Clear trades button
    document.getElementById('clear-trades')?.addEventListener('click', clearAllTrades);

    // Modal
    const modal = document.getElementById('trade-modal');
    document.querySelector('.close')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Trade form
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedSide = e.target.dataset.side;
            updateTradeSummary();
        });
    });

    document.getElementById('trade-size')?.addEventListener('input', updateTradeSummary);
    document.getElementById('trade-price')?.addEventListener('input', updateTradeSummary);
    document.getElementById('execute-trade-btn')?.addEventListener('click', executeTrade);
}

// Load All Data (called once on page load and on refresh all)
async function loadAllData() {
    console.log('🔄 Loading all data...');
    try {
        await Promise.all([
            loadMarkets(),
            loadEdgeOpportunities(),
            loadTrades(),
            loadPnL(),
            loadNews(),
            loadBalance()
        ]);
        updateStatus('connected');
        console.log('✅ All data loaded successfully');
        showNotification('All data refreshed!', 'success');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showNotification('Failed to load data', 'error');
    }
}

// Load Markets
async function loadMarkets() {
    try {
        console.log('📊 Loading markets...');
        const response = await fetch(`${API_URL}/api/markets`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        markets = await response.json();
        console.log(`✅ Loaded ${markets.length} markets`);
        
        // Extract and log available categories
        populateCategoryFilter();
        
        renderMarkets(markets);
    } catch (error) {
        console.error('❌ Error loading markets:', error);
        showNotification('Failed to load markets', 'error');
    }
}

// Populate category filter with actual categories from markets
function populateCategoryFilter() {
    const categories = new Set();
    
    markets.forEach(m => {
        // Check tags for meaningful categories
        let tags = m.tags || [];
        if (typeof tags === 'string') {
            try {
                tags = JSON.parse(tags);
            } catch (e) {}
        }
        
        if (Array.isArray(tags)) {
            tags.forEach(tag => {
                if (typeof tag === 'object') {
                    const label = tag.label || '';
                    const slug = tag.slug || '';
                    
                    // Only include non-numeric, meaningful categories
                    if (label && !isNumericCategory(label)) {
                        categories.add(label);
                    }
                    if (slug && !isNumericCategory(slug)) {
                        categories.add(slug);
                    }
                } else if (tag && !isNumericCategory(String(tag))) {
                    categories.add(String(tag));
                }
            });
        }
    });
    
    // Filter to sports/esports and other relevant categories
    const sportsKeywords = ['sport', 'nba', 'nfl', 'mlb', 'nhl', 'soccer', 'football', 
                            'basketball', 'baseball', 'hockey', 'esport', 'gaming', 
                            'league', 'champions', 'premier', 'world cup'];
    
    const relevantCategories = Array.from(categories).filter(cat => {
        const lower = cat.toLowerCase();
        return sportsKeywords.some(keyword => lower.includes(keyword)) ||
               ['crypto', 'politics', 'ai', 'technology', 'business', 'entertainment'].includes(lower);
    });
    
    console.log('📂 Available categories:', relevantCategories.sort());
    
    // Update dropdown with filtered categories
    const select = document.getElementById('category-filter');
    if (select) {
        const currentValue = select.value;
        
        // Set up focused categories
        select.innerHTML = `
            <option value="">All Categories</option>
            <option value="sports">Sports</option>
            <option value="esports">Esports</option>
            <option value="nba">NBA</option>
            <option value="nfl">NFL</option>
            <option value="soccer">Soccer</option>
            <option value="crypto">Crypto</option>
            <option value="politics">Politics</option>
        `;
        
        // Add any other relevant categories found
        relevantCategories
            .sort()
            .slice(0, 15)
            .forEach(cat => {
                const lower = cat.toLowerCase();
                // Don't duplicate if already added
                if (!['sports', 'esports', 'nba', 'nfl', 'soccer', 'crypto', 'politics'].includes(lower)) {
                    const option = document.createElement('option');
                    option.value = lower;
                    option.textContent = cat;
                    select.appendChild(option);
                }
            });
        
        if (currentValue) select.value = currentValue;
        
        console.log(`✅ Category filter focused on sports/esports`);
    }
}

// Helper to filter out numeric/volume categories
function isNumericCategory(str) {
    const lower = str.toLowerCase();
    // Filter out volume ranges, dates, and numeric patterns
    return /^\d/.test(str) ||                    // Starts with number
           /\d+-\d+/.test(str) ||                // Contains range like 100-200
           lower.includes('billion') ||
           lower.includes('million') ||
           lower.includes('years') ||
           lower.includes('month') ||
           lower.endsWith('b') ||
           lower.endsWith('k') ||
           lower.endsWith('m') ||
           lower.endsWith('t');
}

// Load Balance
async function loadBalance() {
    try {
        const response = await fetch(`${API_URL}/api/balance`);
        const balance = await response.json();
        updateBalanceDisplay(balance);
    } catch (error) {
        console.error('Error loading balance:', error);
        // Don't show error notification for balance - just keep previous value
    }
}

// Update Balance Display
function updateBalanceDisplay(balance) {
    const balanceEl = document.getElementById('balance-usdc');
    if (balanceEl && balance) {
        const amount = balance.usdc || 0;
        balanceEl.textContent = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Add animation for balance changes
        balanceEl.style.animation = 'none';
        setTimeout(() => {
            balanceEl.style.animation = 'pulse 0.5s ease-in-out';
        }, 10);
    }
}

// Render Markets
function renderMarkets(marketsToRender) {
    const grid = document.getElementById('markets-grid');
    if (!grid) return;

    if (marketsToRender.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No markets found</p>';
        return;
    }

    grid.innerHTML = marketsToRender.map(market => {
        // Parse outcome prices - they come as JSON strings from Polymarket API
        let yesPrice = '50.0';
        let noPrice = '50.0';
        
        try {
            if (market.outcomePrices) {
                // If it's a string, parse it; if it's already an array, use it
                const prices = typeof market.outcomePrices === 'string' 
                    ? JSON.parse(market.outcomePrices) 
                    : market.outcomePrices;
                
                if (Array.isArray(prices) && prices.length >= 2) {
                    yesPrice = (parseFloat(prices[0]) * 100).toFixed(1);
                    noPrice = (parseFloat(prices[1]) * 100).toFixed(1);
                }
            }
        } catch (e) {
            console.error('Error parsing prices for market:', market.id, e);
        }
        
        const volume = formatMoney(market.volume || 0);
        
        // Get category from various possible fields
        const category = market.category || 
                        (market.tags && market.tags.length > 0 ? market.tags[0] : '') ||
                        (market.groupItemTitle || '');

        return `
            <div class="market-card" data-market-id="${market.id}" data-category="${category.toLowerCase()}">
                <div class="market-title">${market.question || market.name || 'Unknown Market'}</div>
                <div class="market-meta">
                    <span>Vol: ${volume}</span>
                    <span>${new Date(market.endDate || Date.now()).toLocaleDateString()}</span>
                    ${category ? `<span>${category}</span>` : ''}
                </div>
                <div class="market-prices">
                    <button class="price-btn yes" data-side="YES" onclick="event.stopPropagation()">
                        <span class="price-label">YES</span>
                        <span class="price-value">${yesPrice}¢</span>
                    </button>
                    <button class="price-btn no" data-side="NO" onclick="event.stopPropagation()">
                        <span class="price-label">NO</span>
                        <span class="price-value">${noPrice}¢</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers for cards
    grid.querySelectorAll('.market-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.price-btn')) return; // Don't trigger on button clicks
            const marketId = card.dataset.marketId;
            const market = marketsToRender.find(m => m.id === marketId);
            if (market) openTradeModal(market);
        });
    });

    // Add click handlers for price buttons
    grid.querySelectorAll('.price-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.market-card');
            const marketId = card.dataset.marketId;
            const market = marketsToRender.find(m => m.id === marketId);
            const side = btn.dataset.side;
            if (market) {
                openTradeModal(market, side);
            }
        });
    });
}

// Filter Markets
function filterMarkets() {
    const searchTerm = (document.getElementById('market-search')?.value || '').toLowerCase().trim();
    const categoryFilter = (document.getElementById('category-filter')?.value || '').toLowerCase().trim();

    console.log('🔍 Filtering markets:', { 
        searchTerm, 
        categoryFilter, 
        totalMarkets: markets.length
    });

    if (markets.length === 0) {
        console.warn('⚠️ No markets loaded yet - cannot filter');
        return;
    }

    // Log first market structure to see what data we have
    if (markets.length > 0) {
        console.log('📊 Sample market structure:', {
            id: markets[0].id,
            question: markets[0].question,
            tags: markets[0].tags,
            category: markets[0].category,
            groupItemTitle: markets[0].groupItemTitle
        });
    }

    let filtered = markets;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(m => {
            const question = (m.question || m.name || '').toLowerCase();
            const description = (m.description || '').toLowerCase();
            return question.includes(searchTerm) || description.includes(searchTerm);
        });
        console.log(`🔎 Search filtered to ${filtered.length} markets`);
    }

    // Apply category filter
    if (categoryFilter && categoryFilter !== '') {
        const beforeFilter = filtered.length;
        
        filtered = filtered.filter(m => {
            // Parse tags if they're a string
            let tags = m.tags || [];
            if (typeof tags === 'string') {
                try {
                    tags = JSON.parse(tags);
                } catch (e) {
                    tags = [];
                }
            }
            
            // Get all possible category sources
            const marketCategory = (m.category || '').toLowerCase();
            const marketTags = Array.isArray(tags) 
                ? tags.map(t => typeof t === 'object' ? (t.label || t.slug || '').toLowerCase() : String(t).toLowerCase()).join(' ')
                : '';
            const marketGroup = (m.groupItemTitle || '').toLowerCase();
            const marketQuestion = (m.question || m.name || '').toLowerCase();
            const marketDesc = (m.description || '').toLowerCase();
            
            // Match if category appears in any of these fields
            const matches = marketCategory.includes(categoryFilter) || 
                   marketTags.includes(categoryFilter) ||
                   marketGroup.includes(categoryFilter) ||
                   marketQuestion.includes(categoryFilter) ||
                   marketDesc.includes(categoryFilter);
            
            return matches;
        });
        
        console.log(`🏷️ Category '${categoryFilter}' filtered from ${beforeFilter} to ${filtered.length} markets`);
        
        if (filtered.length === 0) {
            console.warn(`⚠️ No markets found for category '${categoryFilter}' - try a different filter`);
        }
    }

    console.log(`✅ Final filtered results: ${filtered.length} markets`);
    renderMarkets(filtered);
}

// Load Edge Opportunities
async function loadEdgeOpportunities() {
    try {
        console.log('🎯 Loading edge opportunities...');
        const response = await fetch(`${API_URL}/api/edge-opportunities`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        edgeOpportunities = await response.json();
        console.log(`✅ Loaded ${edgeOpportunities.length} edge opportunities`);
        renderEdgeOpportunities();
        updateEdgeStats();
    } catch (error) {
        console.error('❌ Error loading edge opportunities:', error);
        showNotification('Failed to load edge opportunities', 'error');
    }
}

// Render Edge Opportunities - Simple List
function renderEdgeOpportunities() {
    const container = document.getElementById('edge-opportunities');
    if (!container) return;

    if (edgeOpportunities.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No edge opportunities detected</p>';
        return;
    }

    // Sort by edge score
    const sorted = [...edgeOpportunities].sort((a, b) => (b.edgeScore || 0) - (a.edgeScore || 0));

    container.innerHTML = sorted.map(opp => {
        const hasAlerts = opp.alerts && opp.alerts.length > 0;
        const alertBadge = hasAlerts ? `<span class="edge-item-badge">🔥 ALERT</span>` : '';
        const edgeScore = ((opp.edgeScore || 0) * 100).toFixed(1);
        const suggestedSide = opp.suggestedSide || 'YES';
        
        // Parse prices correctly
        let price = 0.5;
        try {
            if (suggestedSide === 'YES' && opp.yesPrice) {
                price = typeof opp.yesPrice === 'string' ? parseFloat(opp.yesPrice) : opp.yesPrice;
            } else if (opp.noPrice) {
                price = typeof opp.noPrice === 'string' ? parseFloat(opp.noPrice) : opp.noPrice;
            }
        } catch (e) {
            console.error('Error parsing edge price:', e);
        }
        
        const priceDisplay = (price * 100).toFixed(1);
        const volume = formatVolume(opp.volume24h || 0);

        return `
            <div class="edge-item ${hasAlerts ? 'high-alert' : ''}" data-market-id="${opp.marketId}" data-side="${suggestedSide}">
                <div class="edge-item-info">
                    <div class="edge-item-title">${opp.marketName}</div>
                    <div class="edge-item-details">
                        <span>${suggestedSide} @ ${priceDisplay}¢</span>
                        <span>Vol: ${volume}</span>
                        <span>${opp.confidence} conf</span>
                        ${alertBadge}
                    </div>
                </div>
                <div class="edge-item-score">${edgeScore}%</div>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.edge-item').forEach(item => {
        item.addEventListener('click', () => {
            const marketId = item.dataset.marketId;
            const side = item.dataset.side;
            const opp = edgeOpportunities.find(o => o.marketId === marketId);
            if (opp) {
                // Create market object with parsed prices
                let yesPriceVal = 0.5;
                let noPriceVal = 0.5;
                try {
                    if (opp.yesPrice) yesPriceVal = typeof opp.yesPrice === 'string' ? parseFloat(opp.yesPrice) : opp.yesPrice;
                    if (opp.noPrice) noPriceVal = typeof opp.noPrice === 'string' ? parseFloat(opp.noPrice) : opp.noPrice;
                } catch (e) {
                    console.error('Error parsing prices for edge modal:', e);
                }
                
                const market = {
                    id: opp.marketId,
                    question: opp.marketName,
                    description: opp.marketDescription,
                    outcomePrices: [yesPriceVal, noPriceVal],
                    endDate: opp.endDate || Date.now(),
                    volume: opp.volume24h || 0
                };
                openTradeModal(market, side);
            }
        });
    });
}

// Format volume helper
function formatVolume(volume) {
    if (volume >= 1000000) {
        return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
        return `$${(volume / 1000).toFixed(1)}k`;
    } else {
        return `$${volume.toFixed(0)}`;
    }
}

// Update Edge Stats
function updateEdgeStats() {
    const totalEl = document.getElementById('total-edges');
    const avgEl = document.getElementById('avg-edge');
    const highEl = document.getElementById('high-conf');
    
    if (totalEl) totalEl.textContent = edgeOpportunities.length;
    
    if (avgEl && edgeOpportunities.length > 0) {
        const avgEdge = edgeOpportunities.reduce((sum, opp) => sum + (opp.edgeScore || 0), 0) / edgeOpportunities.length;
        avgEl.textContent = `${(avgEdge * 100).toFixed(1)}%`;
    }
    
    if (highEl) {
        const highConf = edgeOpportunities.filter(opp => opp.confidence === 'high').length;
        highEl.textContent = highConf;
    }
}

// Load Trades
async function loadTrades() {
    try {
        console.log('📋 Loading trades...');
        const response = await fetch(`${API_URL}/api/trades`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        trades = await response.json();
        console.log(`✅ Loaded ${trades.length} trades`);
        renderTrades();
    } catch (error) {
        console.error('❌ Error loading trades:', error);
        showNotification('Failed to load trades', 'error');
    }
}

// Render Trades
function renderTrades(tradesToRender = trades) {
    const container = document.getElementById('trades-table');
    if (!container) return;

    if (tradesToRender.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No trades yet</p>';
        return;
    }

    // Create table
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Market</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Price</th>
                    <th>Edge</th>
                    <th>Status</th>
                    <th>P&L</th>
                </tr>
            </thead>
            <tbody>
                ${tradesToRender.map(trade => {
                    const statusClass = trade.status === 'executed' ? 'success' : 
                                      trade.status === 'failed' ? 'danger' : 'warning';
                    const sideClass = trade.side === 'YES' ? 'success' : 'danger';
                    const pnlClass = (trade.pnl || 0) >= 0 ? 'success' : 'danger';
                    
                    return `
                        <tr>
                            <td>${trade.market_name || 'Unknown Market'}</td>
                            <td class="${sideClass}">${trade.side}</td>
                            <td>$${trade.size || 0}</td>
                            <td>${trade.price || 0}¢</td>
                            <td>${trade.edge || '-'}</td>
                            <td class="status-badge ${statusClass}">${trade.status.toUpperCase()}</td>
                            <td class="${pnlClass}">${formatPnL(trade.pnl || 0)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Format P&L
function formatPnL(pnl) {
    const prefix = pnl >= 0 ? '+' : '';
    return `${prefix}$${pnl.toFixed(2)}`;
}

// Filter Trades
function filterTrades() {
    const status = document.getElementById('trade-status-filter')?.value || 'all';
    
    if (status === 'all') {
        renderTrades(trades);
    } else {
        const filtered = trades.filter(t => t.status === status);
        renderTrades(filtered);
    }
}

// Clear All Trades
async function clearAllTrades() {
    if (!confirm('Are you sure you want to clear all trades? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/trades`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            trades = [];
            renderTrades([]);
            await loadPnL(); // Refresh P&L after clearing
            showNotification('All trades cleared successfully', 'success');
        } else {
            throw new Error('Failed to clear trades');
        }
    } catch (error) {
        console.error('Error clearing trades:', error);
        showNotification('Failed to clear trades', 'error');
    }
}

// Render Trades
function renderTrades(tradesToRender = trades) {
    const container = document.getElementById('trades-table');
    if (!container) return;

    if (tradesToRender.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No trades yet</p>';
        return;
    }

    container.innerHTML = `
        <div class="trade-row header">
            <div>Market</div>
            <div>Side</div>
            <div>Size</div>
            <div>Price</div>
            <div>Edge</div>
            <div>Status</div>
            <div>P&L</div>
        </div>
        ${tradesToRender.map(trade => `
            <div class="trade-row">
                <div>${trade.market_name}</div>
                <div><strong>${trade.side}</strong></div>
                <div>$${trade.size.toFixed(2)}</div>
                <div>${trade.price}¢</div>
                <div>${trade.edge ? (trade.edge * 100).toFixed(1) + '%' : '-'}</div>
                <div><span class="status-badge ${trade.status}">${trade.status.toUpperCase()}</span></div>
                <div class="${trade.pnl > 0 ? 'profit-positive' : trade.pnl < 0 ? 'profit-negative' : ''}">
                    ${trade.pnl !== 0 ? formatMoney(trade.pnl) : '-'}
                </div>
            </div>
        `).join('')}
    `;
}

// Filter Trades
function filterTrades() {
    const status = document.getElementById('trade-status-filter')?.value || 'all';
    
    let filtered = trades;
    if (status !== 'all') {
        filtered = trades.filter(t => t.status === status);
    }
    
    renderTrades(filtered);
}

// Load P&L
async function loadPnL() {
    try {
        console.log('💰 Loading P&L data...');
        const response = await fetch(`${API_URL}/api/pnl`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('✅ Loaded P&L data');
        updatePnLSummary(data.summary);
        renderPnLChart(data.dailyPnl);
        renderTradesChart(data.summary);
    } catch (error) {
        console.error('❌ Error loading P&L:', error);
        showNotification('Failed to load P&L data', 'error');
    }
}

// Update P&L Summary
function updatePnLSummary(summary) {
    document.getElementById('total-pnl').textContent = formatMoney(summary.total_pnl || 0);
    document.getElementById('total-pnl').className = `stat-value ${summary.total_pnl > 0 ? 'profit-positive' : summary.total_pnl < 0 ? 'profit-negative' : ''}`;
    
    document.getElementById('total-trades-count').textContent = summary.total_trades || 0;
    
    const winRate = summary.winning_trades && summary.total_trades 
        ? (summary.winning_trades / summary.total_trades * 100).toFixed(1) 
        : 0;
    document.getElementById('win-rate').textContent = `${winRate}%`;
    
    document.getElementById('avg-trade-pnl').textContent = formatMoney(summary.avg_pnl || 0);
}

// Render P&L Chart
function renderPnLChart(dailyPnl) {
    const ctx = document.getElementById('pnl-chart');
    if (!ctx) return;

    if (pnlChart) {
        pnlChart.destroy();
    }

    // Calculate cumulative P&L
    let cumulative = 0;
    const cumulativeData = dailyPnl.map(day => {
        cumulative += day.pnl || 0;
        return cumulative;
    });

    pnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyPnl.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'P&L',
                data: cumulativeData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 1,
                pointHoverRadius: 3,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 5,
                    bottom: 5,
                    left: 5,
                    right: 5
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'P&L',
                    color: '#f1f5f9',
                    font: { size: 11, weight: 'bold' },
                    padding: { top: 5, bottom: 5 }
                }
            },
            scales: {
                y: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 8 },
                        maxTicksLimit: 4
                    },
                    grid: { 
                        color: '#334155',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 8 },
                        maxRotation: 0,
                        minRotation: 0,
                        maxTicksLimit: 5
                    },
                    grid: { 
                        color: '#334155',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// Render Trades Chart
function renderTradesChart(summary) {
    const ctx = document.getElementById('trades-chart');
    if (!ctx) return;

    if (tradesChart) {
        tradesChart.destroy();
    }

    tradesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Winning Trades', 'Losing Trades'],
            datasets: [{
                data: [summary.winning_trades || 0, summary.losing_trades || 0],
                backgroundColor: ['#10b981', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#f1f5f9' }
                },
                title: {
                    display: true,
                    text: 'Win/Loss Ratio',
                    color: '#f1f5f9',
                    font: { size: 16 }
                }
            }
        }
    });
}

// Load News
async function loadNews() {
    try {
        console.log('📰 Loading news feed...');
        const response = await fetch(`${API_URL}/api/news`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        newsItems = await response.json();
        console.log(`✅ Loaded ${newsItems.length} news items`);
        renderNews();
    } catch (error) {
        console.error('❌ Error loading news:', error);
        showNotification('Failed to load news feed', 'error');
    }
}

// Render News
function renderNews() {
    const container = document.getElementById('news-feed');
    if (!container) return;

    container.innerHTML = newsItems.map(item => `
        <div class="news-item" onclick="window.open('${item.link}', '_blank')">
            <div class="news-title">${item.title}</div>
            <div class="news-description">${item.contentSnippet || item.description || ''}</div>
            <div class="news-meta">
                <span>Mashable</span>
                <span>${new Date(item.pubDate).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

// Open Trade Modal
function openTradeModal(market, suggestedSide = 'YES') {
    selectedMarket = market;
    selectedSide = suggestedSide;

    const modal = document.getElementById('trade-modal');
    document.getElementById('modal-market-name').textContent = market.question || market.name;
    document.getElementById('modal-market-desc').textContent = market.description || '';

    // Parse outcome prices correctly (they come as JSON strings from Polymarket)
    let yesPrice = 50;
    let noPrice = 50;
    
    try {
        if (market.outcomePrices) {
            const prices = typeof market.outcomePrices === 'string' 
                ? JSON.parse(market.outcomePrices) 
                : market.outcomePrices;
            
            if (Array.isArray(prices) && prices.length >= 2) {
                yesPrice = parseFloat(prices[0]) * 100;
                noPrice = parseFloat(prices[1]) * 100;
            }
        }
    } catch (e) {
        console.error('Error parsing prices in modal:', e);
    }

    document.getElementById('modal-yes-price').textContent = `${yesPrice.toFixed(1)}¢`;
    document.getElementById('modal-no-price').textContent = `${noPrice.toFixed(1)}¢`;
    document.getElementById('trade-price').value = suggestedSide === 'YES' ? yesPrice.toFixed(0) : noPrice.toFixed(0);

    // Update side buttons
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.side === suggestedSide);
    });

    updateTradeSummary();
    modal.classList.add('active');
}

// Update Trade Summary
function updateTradeSummary() {
    const size = parseFloat(document.getElementById('trade-size')?.value || 10);
    const price = parseFloat(document.getElementById('trade-price')?.value || 50) / 100;

    const payout = size / price;
    const profit = payout - size;

    document.getElementById('potential-payout').textContent = formatMoney(payout);
    document.getElementById('potential-profit').textContent = formatMoney(profit);
    document.getElementById('potential-profit').className = profit > 0 ? 'profit-positive' : 'profit-negative';
}

// Execute Trade
async function executeTrade() {
    if (!selectedMarket) return;

    const size = parseFloat(document.getElementById('trade-size')?.value || 10);
    const price = parseFloat(document.getElementById('trade-price')?.value || 50);

    try {
        document.getElementById('execute-trade-btn').disabled = true;
        document.getElementById('execute-trade-btn').textContent = 'Placing Trade...';

        const response = await fetch(`${API_URL}/api/trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marketId: selectedMarket.id,
                marketName: selectedMarket.question || selectedMarket.name,
                side: selectedSide,
                size,
                price,
                edge: selectedMarket.edge || 0
            })
        });

        const result = await response.json();

        if (result.success) {
            alert(`Trade ${result.executed ? 'executed' : 'saved'} successfully!`);
            document.getElementById('trade-modal').classList.remove('active');
            loadTrades();
        } else {
            alert(`Trade failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error executing trade:', error);
        alert('Failed to execute trade');
    } finally {
        document.getElementById('execute-trade-btn').disabled = false;
        document.getElementById('execute-trade-btn').textContent = 'Place Trade';
    }
}

// Auto Refresh
function startAutoRefresh() {
    // Refresh markets every 5 minutes
    setInterval(() => {
        if (currentTab === 'markets') loadMarkets();
    }, 5 * 60 * 1000);

    // Refresh edge opportunities every 10 minutes
    setInterval(() => {
        if (currentTab === 'edge') loadEdgeOpportunities();
    }, 10 * 60 * 1000);
}

// Utilities
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function updateStatus(status) {
    const indicator = document.getElementById('status');
    if (status === 'connected') {
        indicator.style.background = 'var(--success-color)';
    } else {
        indicator.style.background = 'var(--danger-color)';
    }
}

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading...</p>';
    }
}

function showError(message) {
    console.error(message);
    // Could add toast notification here
}

