# Polymarket Edge Detection Dashboard

A sophisticated dashboard for finding edge opportunities in Polymarket prediction markets with automated trading capabilities.

## Features

- 📊 **Real-time Market Data**: Live Polymarket market data with price tracking
- 🎯 **Edge Detection**: Algorithm identifies mispriced markets based on multiple factors
- 🤖 **Automated Trading**: Optional automation to execute trades when edge is detected
- 📰 **RSS News Feed**: Integrated Mashable feed for market context and edge opportunities
- 📈 **P&L Tracking**: Comprehensive profit/loss tracking with visual graphs
- 📋 **Trade History**: Complete log of all executed trades
- 🎨 **Modern UI**: Clean, Polymarket-inspired interface

## Installation

```bash
cd polymarket-dashboard
npm install
```

## Configuration

Create a `.env` file in the root directory:

```
POLYMARKET_API_KEY=your_api_key_here
POLYMARKET_PRIVATE_KEY=your_wallet_private_key
AUTO_TRADE_ENABLED=false
MAX_TRADE_SIZE=100
MIN_EDGE_THRESHOLD=0.05
PORT=3005
```

## Usage

Start the server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

Open your browser to `http://localhost:3005`

## Edge Detection Algorithm

The dashboard identifies edge opportunities based on:

1. **News Correlation**: Matches RSS news events with relevant markets
2. **Volume Analysis**: Low volume markets may have inefficient pricing
3. **Spread Analysis**: Wide bid-ask spreads indicate opportunity
4. **Historical Performance**: Markets with unusual price movements
5. **Probability Arbitrage**: Comparing market prices to calculated probabilities

## Safety Features

- Manual approval required for all trades (unless AUTO_TRADE_ENABLED=true)
- Configurable position size limits
- Edge threshold requirements
- Trade logging and audit trail

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Blockchain**: ethers.js for Polygon integration
- **Frontend**: Vanilla JS, Chart.js
- **APIs**: Polymarket CLOB API, RSS Parser

## Warning

This software is for educational purposes. Trading prediction markets involves risk. Never invest more than you can afford to lose.

