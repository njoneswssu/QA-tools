# 📈 Stock Tracker Pro

A professional web-based stock tracking application with real-time data, interactive charts, and portfolio management features.

## ✨ Features

- **🔍 Real-time Stock Search**: Enter any stock symbol to get current price, change, and volume information
- **📊 Interactive Dual Charts**: View stock price and volume in separate, synchronized subplots
- **⭐ Smart Watchlist**: Save favorite stocks and click to instantly view their charts
- **📈 Multiple Time Periods**: 1 week, 1 month, 3 months, 6 months, and 1 year views
- **🎨 Modern Web Interface**: Professional, responsive design with beautiful visualizations
- **🚀 Live Data**: Fetches up-to-date stock data using Yahoo Finance API
- **💡 Clean Chart Layout**: Legend and data info positioned outside chart area for maximum clarity

## 🛠️ Installation

1. **Prerequisites**: Python 3.7 or higher
2. **Create Virtual Environment** (recommended):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## 🚀 Usage

1. **Start the Application**:
   ```bash
   python3 stock_tracker_web.py
   ```

2. **Open in Browser**:
   - Navigate to `http://localhost:8080`
   - The application will automatically open in your default browser

3. **Search for Stocks**:
   - Enter a stock symbol (e.g., AAPL, GOOGL, TSLA, CAVA) in the search field
   - Press Enter or click "🔍 Search Stock"
   - View real-time price, change percentage, and volume data

4. **Analyze Charts**:
   - Charts automatically display after searching
   - **Price Chart**: Line chart with high/low range shading
   - **Volume Chart**: Color-coded bars (green for up days, red for down days)
   - Select time periods using the period selector buttons

5. **Manage Watchlist**:
   - Click "⭐ Add to Watchlist" to save the current stock
   - Click any stock in the watchlist to instantly view its chart and data
   - Use the 🗑️ button to remove stocks from your watchlist
   - Watchlist is automatically saved and restored between sessions

## 📊 Supported Stock Symbols

The application supports any stock symbol available on Yahoo Finance, including:
- **US Stocks**: AAPL, GOOGL, MSFT, TSLA, CAVA, PRGS, etc.
- **International Stocks**: Add appropriate suffix (e.g., ASML.AS for European stocks)
- **ETFs and Mutual Funds**: SPY, QQQ, VTI, etc.
- **Cryptocurrencies**: BTC-USD, ETH-USD, DOGE-USD, etc.

## 📋 Requirements

- **Python**: 3.7 or higher
- **Flask**: 3.0.0 (web framework)
- **yfinance**: 0.2.65 (Yahoo Finance API)
- **plotly**: 5.17.0 (interactive charts)
- **pandas**: 2.1.4 (data manipulation)
- **numpy**: 1.26.2 (numerical operations)
- **matplotlib**: 3.8.2 (additional plotting support)

## 🔧 Technical Features

- **Web-based Architecture**: Flask backend with responsive HTML/CSS/JavaScript frontend
- **Dual Subplot Charts**: Separate price and volume visualization using Plotly
- **Clean Layout**: Legend and metadata positioned outside chart area
- **Real-time Updates**: Live stock data with automatic chart refresh
- **Error Handling**: Graceful handling of invalid symbols and API rate limits
- **Persistent Storage**: Watchlist saved locally in JSON format

## 📝 Notes

- **Internet Required**: Application needs internet connection for live stock data
- **Data Source**: Yahoo Finance API (free tier with rate limiting)
- **Update Frequency**: Real-time data with small delays for API protection
- **Storage**: Watchlist saved in `watchlist.json` file
- **Browser Compatibility**: Works with all modern browsers (Chrome, Firefox, Safari, Edge)
- **Port**: Runs on `localhost:8080` by default

## 🚨 Troubleshooting

- **Port in Use**: If port 8080 is busy, the app will show an error. Stop other services or change the port in the code
- **No Data**: If stocks don't load, check internet connection and verify stock symbols are correct
- **Rate Limiting**: If you get "Too Many Requests" errors, wait a few minutes before searching again
