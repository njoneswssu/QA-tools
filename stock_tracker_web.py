from flask import Flask, render_template, request, jsonify
import yfinance as yf
import json
import os
from datetime import datetime
import plotly.graph_objs as go
import plotly.utils

app = Flask(__name__)

class StockTracker:
    def __init__(self):
        self.watchlist_file = "watchlist.json"
        self.watchlist = self.load_watchlist()
    
    def load_watchlist(self):
        try:
            if os.path.exists(self.watchlist_file):
                with open(self.watchlist_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return []
    
    def save_watchlist(self):
        try:
            with open(self.watchlist_file, 'w') as f:
                json.dump(self.watchlist, f)
        except Exception as e:
            print(f"Error saving watchlist: {e}")
    
    def get_stock_data(self, symbol):
        """Get real-time stock data - only returns actual market data"""
        try:
            import time
            from datetime import datetime
            
            # Small delay to avoid overwhelming the API
            time.sleep(0.2)
            
            stock = yf.Ticker(symbol)
            
            # Get the most recent trading data
            hist = stock.history(period="5d", interval="1d")
            
            if hist.empty:
                print(f"No historical data available for {symbol}")
                return None
            
            # Get current/latest price
            current_price = hist['Close'].iloc[-1]
            current_volume = hist['Volume'].iloc[-1]
            
            # Calculate change from previous trading day
            if len(hist) > 1:
                previous_close = hist['Close'].iloc[-2]
                change = current_price - previous_close
                change_percent = (change / previous_close) * 100
            else:
                change = 0
                change_percent = 0
            
            # Try to get company name from info (with timeout protection)
            company_name = symbol
            try:
                info = stock.info
                if info and 'longName' in info:
                    company_name = info['longName']
                elif info and 'shortName' in info:
                    company_name = info['shortName']
            except:
                # If info fails, just use the symbol
                pass
            
            # Get the timestamp of the latest data
            last_updated = hist.index[-1].strftime("%Y-%m-%d %H:%M:%S UTC")
            
            return {
                'symbol': symbol,
                'name': company_name,
                'price': round(float(current_price), 2),
                'change': round(float(change), 2),
                'change_percent': round(float(change_percent), 2),
                'volume': int(current_volume) if current_volume > 0 else 0,
                'last_updated': last_updated
            }
                
        except Exception as e:
            print(f"Error fetching real data for {symbol}: {e}")
            return None
    
    def get_chart_data(self, symbol, period="1mo"):
        """Get real stock chart data with price and volume subplots"""
        try:
            import time
            from plotly.subplots import make_subplots
            
            # Small delay to avoid API limits
            time.sleep(0.3)
            
            stock = yf.Ticker(symbol)
            hist = stock.history(period=period)
            
            if hist.empty:
                print(f"No chart data available for {symbol} - {period}")
                return None
            
            # Debug: Print actual data being used
            print(f"Chart data for {symbol} ({period}):")
            print(f"  Date range: {hist.index[0]} to {hist.index[-1]}")
            print(f"  Latest close: ${hist['Close'].iloc[-1]:.2f}")
            print(f"  Price range: ${hist['Low'].min():.2f} - ${hist['High'].max():.2f}")
            print(f"  Data points: {len(hist)}")
            print(f"  Close data type: {type(hist['Close'].iloc[0])}")
            print(f"  Sample close values: {hist['Close'].tail(3).tolist()}")
            print(f"  Close as float: {hist['Close'].astype(float).tail(3).tolist()}")
            
            # Create subplots: price on top, volume on bottom
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.15,
                subplot_titles=(f'{symbol} Stock Price', 'Trading Volume'),
                row_heights=[0.7, 0.3],  # Price chart takes 70%, volume takes 30%
                specs=[[{"secondary_y": False}], [{"secondary_y": False}]]
            )
            
            # Convert data to clean Python lists to avoid any pandas/numpy issues
            dates = [d.strftime('%Y-%m-%d') for d in hist.index]
            close_prices = [float(x) for x in hist['Close']]
            high_prices = [float(x) for x in hist['High']]
            low_prices = [float(x) for x in hist['Low']]
            
            print(f"  Converted close prices (last 3): {close_prices[-3:]}")
            
            # Add price line chart
            fig.add_trace(
                go.Scatter(
                    x=hist.index,
                    y=close_prices,
                    mode='lines',
                    name='Close Price',
                    line=dict(color='#2E86AB', width=2.5),
                    hovertemplate='<b>$%{y:.2f}</b><br>%{x|%Y-%m-%d}<extra></extra>'
                ),
                row=1, col=1
            )
            
            # Add high/low area fill for price range
            fig.add_trace(
                go.Scatter(
                    x=hist.index,
                    y=high_prices,
                    mode='lines',
                    line=dict(width=0),
                    showlegend=False,
                    hoverinfo='skip'
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(
                    x=hist.index,
                    y=low_prices,
                    mode='lines',
                    line=dict(width=0),
                    fill='tonexty',
                    fillcolor='rgba(46, 134, 171, 0.1)',
                    name='Price Range',
                    hovertemplate='Low: $%{y:.2f}<br>%{x|%Y-%m-%d}<extra></extra>'
                ),
                row=1, col=1
            )
            
            # Add volume bar chart
            if not hist['Volume'].empty:
                # Convert volume to clean list
                volumes = [float(x) for x in hist['Volume']]
                
                # Color volume bars based on price change
                colors = []
                for i in range(len(close_prices)):
                    if i == 0:
                        colors.append('#95A5A6')  # Neutral for first bar
                    else:
                        if close_prices[i] >= close_prices[i-1]:
                            colors.append('#27AE60')  # Green for up days
                        else:
                            colors.append('#E74C3C')  # Red for down days
                
                fig.add_trace(
                    go.Bar(
                        x=hist.index,
                        y=volumes,
                        name='Volume',
                        marker_color=colors,
                        hovertemplate='Volume: %{y:,.0f}<br>%{x|%Y-%m-%d}<extra></extra>',
                        opacity=0.7
                    ),
                    row=2, col=1
                )
            
            # Get data freshness info
            latest_date = hist.index[-1].strftime("%Y-%m-%d")
            
            # Update layout with legend and data outside chart
            fig.update_layout(
                title=dict(
                    text=f'<b>{symbol} Stock Analysis - {period.upper()}</b><br><span style="font-size: 12px; color: #7f8c8d;">Latest data: {latest_date}</span>',
                    x=0.5,
                    xanchor='center',
                    font=dict(size=20, color='#2c3e50'),
                    y=0.95,
                    pad=dict(t=10)
                ),
                template='plotly_white',
                height=650,
                showlegend=True,
                margin=dict(l=80, r=80, t=140, b=100),
                hovermode='x unified',
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.08,
                    xanchor="center",
                    x=0.5,
                    bgcolor="rgba(248,249,250,0.95)",
                    bordercolor="rgba(0,0,0,0.2)",
                    borderwidth=1,
                    font=dict(size=11),
                    itemsizing='constant'
                )
            )
            
            # Update axes
            fig.update_xaxes(title_text="Date", row=2, col=1)
            fig.update_yaxes(title_text="Price ($)", row=1, col=1)
            fig.update_yaxes(title_text="Volume", row=2, col=1)
            
            # Format volume axis to show in millions/thousands
            fig.update_yaxes(
                tickformat='.2s',  # Scientific notation (1M, 1K, etc.)
                row=2, col=1
            )
            
            return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
            
        except Exception as e:
            print(f"Error creating chart for {symbol}: {e}")
            return None

tracker = StockTracker()

@app.route('/')
def index():
    return render_template('index.html', watchlist=tracker.watchlist)

@app.route('/search', methods=['POST'])
def search_stock():
    symbol = request.json.get('symbol', '').strip().upper()
    if not symbol:
        return jsonify({'error': 'Please enter a stock symbol'})
    
    stock_data = tracker.get_stock_data(symbol)
    if not stock_data:
        return jsonify({'error': f'No current market data available for {symbol}. Please verify the symbol is correct and markets are open.'})
    
    return jsonify(stock_data)

@app.route('/chart', methods=['POST'])
def get_chart():
    symbol = request.json.get('symbol', '').strip().upper()
    period = request.json.get('period', '1mo')
    
    if not symbol:
        return jsonify({'error': 'No symbol provided'})
    
    chart_data = tracker.get_chart_data(symbol, period)
    if not chart_data:
        return jsonify({'error': 'Could not generate chart'})
    
    return jsonify({'chart': chart_data})

@app.route('/watchlist/add', methods=['POST'])
def add_to_watchlist():
    symbol = request.json.get('symbol', '').strip().upper()
    if symbol and symbol not in tracker.watchlist:
        tracker.watchlist.append(symbol)
        tracker.save_watchlist()
        return jsonify({'success': True, 'message': f'{symbol} added to watchlist'})
    elif symbol in tracker.watchlist:
        return jsonify({'success': False, 'message': f'{symbol} is already in watchlist'})
    else:
        return jsonify({'success': False, 'message': 'Invalid symbol'})

@app.route('/watchlist/remove', methods=['POST'])
def remove_from_watchlist():
    symbol = request.json.get('symbol', '').strip().upper()
    if symbol in tracker.watchlist:
        tracker.watchlist.remove(symbol)
        tracker.save_watchlist()
        return jsonify({'success': True, 'message': f'{symbol} removed from watchlist'})
    else:
        return jsonify({'success': False, 'message': 'Symbol not in watchlist'})

@app.route('/watchlist')
def get_watchlist():
    return jsonify(tracker.watchlist)

if __name__ == '__main__':
    # Create templates directory if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    
    # Create the HTML template
    html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Tracker Pro</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 400px 1fr;
            min-height: 700px;
        }
        
        .sidebar {
            background: #f8f9fa;
            padding: 30px;
            border-right: 1px solid #e9ecef;
        }
        
        .search-section {
            margin-bottom: 30px;
        }
        
        .search-section h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .search-input {
            width: 100%;
            padding: 15px;
            font-size: 18px;
            border: 3px solid #3498db;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
            font-weight: bold;
            background: #e8f4fd;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #2980b9;
            box-shadow: 0 0 10px rgba(52, 152, 219, 0.3);
        }
        
        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            margin: 5px;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #27ae60;
            color: white;
        }
        
        .btn-primary:hover {
            background: #229954;
            transform: translateY(-2px);
        }
        
        .btn-secondary {
            background: #f39c12;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #e67e22;
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background: #e74c3c;
            color: white;
        }
        
        .btn-danger:hover {
            background: #c0392b;
            transform: translateY(-2px);
        }
        
        .stock-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .stock-info h3 {
            color: #2c3e50;
            margin-bottom: 15px;
        }
        
        .stock-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }
        
        .stock-price {
            font-size: 24px;
            font-weight: bold;
            color: #27ae60;
            margin-bottom: 8px;
        }
        
        .stock-change {
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .stock-volume {
            font-size: 14px;
            color: #7f8c8d;
        }
        
        .positive {
            color: #27ae60;
        }
        
        .negative {
            color: #e74c3c;
        }
        
        .watchlist {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .watchlist h3 {
            color: #2c3e50;
            margin-bottom: 15px;
        }
        
        .watchlist-item {
            padding: 10px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .watchlist-item:hover {
            background: #e9ecef;
            transform: translateX(5px);
        }
        
        .chart-area {
            padding: 30px;
        }
        
        .period-selector {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .period-btn {
            padding: 8px 16px;
            margin: 0 5px;
            border: 2px solid #3498db;
            background: white;
            color: #3498db;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .period-btn.active,
        .period-btn:hover {
            background: #3498db;
            color: white;
        }
        
        .chart-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
            min-height: 750px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .empty-chart {
            text-align: center;
            color: #7f8c8d;
            font-size: 18px;
        }
        
        .loading {
            color: #3498db;
            font-style: italic;
        }
        
        .error {
            color: #e74c3c;
            background: #fdf2f2;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        
        .success {
            color: #27ae60;
            background: #f0f9f0;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📈 Stock Tracker Pro</h1>
            <p>Professional Stock Analysis & Portfolio Management</p>
        </div>
        
        <div class="main-content">
            <div class="sidebar">
                <div class="search-section">
                    <h3>🔍 Stock Search</h3>
                    <input type="text" id="stockInput" class="search-input" placeholder="Enter stock symbol (e.g., AAPL)" autofocus>
                    <div>
                        <button class="btn btn-primary" onclick="searchStock()">🔍 Search Stock</button>
                        <button class="btn btn-secondary" onclick="addToWatchlist()">⭐ Add to Watchlist</button>
                    </div>
                    <div id="message"></div>
                </div>
                
                <div class="stock-info" id="stockInfo" style="display: none;">
                    <h3>📊 Stock Information</h3>
                    <div class="stock-name" id="stockName"></div>
                    <div class="stock-price" id="stockPrice"></div>
                    <div class="stock-change" id="stockChange"></div>
                    <div class="stock-volume" id="stockVolume"></div>
                </div>
                
                <div class="watchlist">
                    <h3>⭐ My Watchlist</h3>
                    <div id="watchlistItems"></div>
                </div>
            </div>
            
            <div class="chart-area">
                <div class="period-selector">
                    <button class="period-btn" data-period="1wk">1 Week</button>
                    <button class="period-btn active" data-period="1mo">1 Month</button>
                    <button class="period-btn" data-period="3mo">3 Months</button>
                    <button class="period-btn" data-period="6mo">6 Months</button>
                    <button class="period-btn" data-period="1y">1 Year</button>
                </div>
                
                <div class="chart-container">
                    <div id="chart" class="empty-chart">
                        Enter a stock symbol and click "Search Stock" to view the chart
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentStock = null;
        let currentPeriod = '1mo';
        
        // Enter key support
        document.getElementById('stockInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchStock();
            }
        });
        
        // Period selector
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentPeriod = this.dataset.period;
                if (currentStock) {
                    loadChart(currentStock, currentPeriod);
                }
            });
        });
        
        function showMessage(message, type = 'error') {
            const messageDiv = document.getElementById('message');
            messageDiv.innerHTML = `<div class="${type}">${message}</div>`;
            setTimeout(() => messageDiv.innerHTML = '', 3000);
        }
        
        function searchStock() {
            const symbol = document.getElementById('stockInput').value.trim().toUpperCase();
            if (!symbol) {
                showMessage('Please enter a stock symbol');
                return;
            }
            
            showMessage('Loading...', 'loading');
            
            fetch('/search', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({symbol: symbol})
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showMessage(data.error);
                    return;
                }
                
                currentStock = data.symbol;
                displayStockInfo(data);
                loadChart(data.symbol, currentPeriod);
                document.getElementById('message').innerHTML = '';
            })
            .catch(error => {
                showMessage('Error fetching stock data');
                console.error('Error:', error);
            });
        }
        
        function displayStockInfo(data) {
            document.getElementById('stockName').textContent = `${data.symbol} - ${data.name}`;
            document.getElementById('stockPrice').textContent = `Price: $${data.price}`;
            
            const changeClass = data.change >= 0 ? 'positive' : 'negative';
            document.getElementById('stockChange').innerHTML = 
                `<span class="${changeClass}">Change: ${data.change > 0 ? '+' : ''}${data.change} (${data.change_percent > 0 ? '+' : ''}${data.change_percent}%)</span>`;
            
            document.getElementById('stockVolume').innerHTML = 
                `Volume: ${data.volume.toLocaleString()}<br><small style="color: #7f8c8d;">Last updated: ${data.last_updated || 'Unknown'}</small>`;
            
            document.getElementById('stockInfo').style.display = 'block';
        }
        
        function loadChart(symbol, period) {
            fetch('/chart', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({symbol: symbol, period: period})
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('chart').innerHTML = `<div class="error">${data.error}</div>`;
                    return;
                }
                
                const chartData = JSON.parse(data.chart);
                Plotly.newPlot('chart', chartData.data, chartData.layout, {responsive: true});
            })
            .catch(error => {
                document.getElementById('chart').innerHTML = '<div class="error">Error loading chart</div>';
                console.error('Error:', error);
            });
        }
        
        function addToWatchlist() {
            if (!currentStock) {
                showMessage('Please search for a stock first');
                return;
            }
            
            fetch('/watchlist/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({symbol: currentStock})
            })
            .then(response => response.json())
            .then(data => {
                showMessage(data.message, data.success ? 'success' : 'error');
                if (data.success) {
                    loadWatchlist();
                }
            })
            .catch(error => {
                showMessage('Error adding to watchlist');
                console.error('Error:', error);
            });
        }
        
        function removeFromWatchlist(symbol) {
            fetch('/watchlist/remove', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({symbol: symbol})
            })
            .then(response => response.json())
            .then(data => {
                showMessage(data.message, data.success ? 'success' : 'error');
                if (data.success) {
                    loadWatchlist();
                }
            })
            .catch(error => {
                showMessage('Error removing from watchlist');
                console.error('Error:', error);
            });
        }
        
        function selectFromWatchlist(symbol) {
            document.getElementById('stockInput').value = symbol;
            
            // Show loading message
            showMessage('Loading stock data...', 'loading');
            
            // Search for the stock data
            fetch('/search', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({symbol: symbol})
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showMessage(data.error);
                    return;
                }
                
                // Update current stock and display info
                currentStock = data.symbol;
                displayStockInfo(data);
                
                // Automatically load the chart for the selected stock
                loadChart(data.symbol, currentPeriod);
                
                // Clear loading message
                document.getElementById('message').innerHTML = '';
            })
            .catch(error => {
                showMessage('Error loading stock from watchlist');
                console.error('Error:', error);
            });
        }
        
        function loadWatchlist() {
            fetch('/watchlist')
            .then(response => response.json())
            .then(watchlist => {
                const container = document.getElementById('watchlistItems');
                container.innerHTML = '';
                
                if (watchlist.length === 0) {
                    container.innerHTML = '<div style="color: #7f8c8d; font-style: italic;">No stocks in watchlist</div>';
                    return;
                }
                
                watchlist.forEach(symbol => {
                    const item = document.createElement('div');
                    item.className = 'watchlist-item';
                    item.innerHTML = `
                        <span onclick="selectFromWatchlist('${symbol}')" style="flex: 1; cursor: pointer;">${symbol}</span>
                        <button class="btn btn-danger" style="padding: 5px 10px; margin: 0;" onclick="removeFromWatchlist('${symbol}')">🗑️</button>
                    `;
                    container.appendChild(item);
                });
            })
            .catch(error => {
                console.error('Error loading watchlist:', error);
            });
        }
        
        // Load watchlist on page load
        loadWatchlist();
    </script>
</body>
</html>'''
    
    with open('templates/index.html', 'w') as f:
        f.write(html_template)
    
    print("🚀 Starting Stock Tracker Pro...")
    print("📈 Open your browser and go to: http://localhost:8080")
    print("💡 Press Ctrl+C to stop the server")
    
    app.run(debug=True, host='0.0.0.0', port=8080)
