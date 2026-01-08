# Polymarket Edge Dashboard - Testing Guide

## 🧪 How to Test the Dashboard

### Step 1: Installation & Setup

```bash
cd /Users/neil/playwrightautomation/polymarket-dashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env (optional - works without credentials in demo mode)
nano .env
```

### Step 2: Start the Server

```bash
npm start
```

Expected output:
```
🚀 Polymarket Dashboard running on http://localhost:3005
📊 Auto-trading: DISABLED
💰 Max trade size: $100
📈 Min edge threshold: 5.0%
```

### Step 3: Open Browser

Navigate to: **http://localhost:3005**

---

## 📋 Testing Checklist

### ✅ Markets Tab (Default View)

**Expected Results:**
- [ ] Page loads with markets grid
- [ ] Markets display with title, volume, and end date
- [ ] YES and NO prices shown
- [ ] Search bar filters markets by keyword
- [ ] Category dropdown filters markets
- [ ] Clicking a market opens trade modal

**Test Actions:**
1. Type "crypto" in search bar → markets filter
2. Select category from dropdown → markets filter
3. Click any market card → trade modal opens

---

### ✅ Edge Opportunities Tab

**Expected Results:**
- [ ] Stats show: Total edges, Avg edge %, High confidence count
- [ ] Edge cards display with:
  - Market name and description
  - Edge score percentage
  - Reason for edge
  - Confidence level (high/medium/low)
  - Suggested side (YES/NO)
- [ ] Cards sorted by edge score (highest first)
- [ ] Clicking edge card opens trade modal

**Test Actions:**
1. Click "Edge Opportunities" tab
2. Click "Refresh Edge Detection" button
3. Wait 3-5 seconds for analysis
4. Review detected opportunities
5. Click an opportunity → trade modal opens with suggested side

---

### ✅ Trade Modal

**Expected Results:**
- [ ] Market name and description displayed
- [ ] Current YES and NO prices shown
- [ ] Side toggle (YES/NO) works
- [ ] Position size input accepts numbers
- [ ] Limit price input accepts numbers
- [ ] Potential payout updates dynamically
- [ ] Potential profit updates dynamically
- [ ] "Place Trade" button works

**Test Actions:**
1. Open any market
2. Toggle between YES and NO → prices update
3. Change position size to $50 → payout recalculates
4. Change limit price → profit updates
5. Click "Place Trade" → trade saved confirmation
6. Close modal (X button or click outside)

---

### ✅ Trades Tab

**Expected Results:**
- [ ] Trade history table displays
- [ ] Columns: Market, Side, Size, Price, Edge, Status, P&L
- [ ] Status filter dropdown works
- [ ] Trades show correct status badges
- [ ] P&L shows green (profit) or red (loss)

**Test Actions:**
1. Create a few test trades from markets
2. Navigate to Trades tab
3. Verify all trades appear
4. Filter by status → table updates
5. Check trade details are accurate

---

### ✅ P&L Tab

**Expected Results:**
- [ ] Summary cards show:
  - Total P&L
  - Total Trades count
  - Win Rate %
  - Avg Trade P&L
- [ ] Cumulative P&L chart displays
- [ ] Win/Loss ratio doughnut chart displays
- [ ] Charts update with trade data

**Test Actions:**
1. Navigate to P&L tab
2. Verify summary stats
3. Check cumulative P&L chart shows trend
4. Check win/loss chart shows ratio
5. Create more trades → refresh P&L → charts update

---

### ✅ News Feed Tab

**Expected Results:**
- [ ] Mashable RSS feed loads
- [ ] News items show:
  - Title
  - Description
  - Source (Mashable)
  - Timestamp
- [ ] Clicking news item opens article in new tab
- [ ] Refresh button reloads feed

**Test Actions:**
1. Navigate to News tab
2. Verify news items load
3. Click "Refresh News" → feed updates
4. Click any news item → opens in new tab
5. Verify recent news appears at top

---

## 🔬 Advanced Testing

### Test Edge Detection Algorithm

Create a scenario to trigger each edge type:

#### 1. **Volume Edge**
- Look for markets with < $10k volume
- Check if flagged with "Low volume market" reason

#### 2. **Spread Edge**
- Find markets where YES + NO ≠ 100¢
- Should flag "Wide spread detected"

#### 3. **News Edge**
- Check if news about "AI" correlates with AI markets
- Should flag "News correlation"

#### 4. **Arbitrage Edge**
- Find markets where YES + NO < 95¢
- Should flag "Arbitrage opportunity"

### Test Trade Workflow

**Full workflow test:**
1. Go to Edge Opportunities
2. Click highest edge opportunity
3. Trade modal opens with suggested side
4. Review edge reasoning
5. Adjust position size
6. Place trade
7. Go to Trades tab → verify appears
8. Go to P&L tab → verify stats update

### Test Auto-Refresh

1. Open dashboard
2. Wait 5 minutes
3. Check console for "Refreshing market data..."
4. Wait 10 minutes
5. Check console for "Running edge detection..."
6. Verify markets/edges auto-update

---

## 🎨 UI/UX Testing

### Visual Tests:
- [ ] Dark theme applied correctly
- [ ] Cards have hover effects
- [ ] Buttons change color on hover
- [ ] Status badges show correct colors
- [ ] Charts render properly
- [ ] Modal overlay dims background
- [ ] Responsive on mobile (resize browser)

### Navigation Tests:
- [ ] Tab switching is instant
- [ ] Active tab highlighted
- [ ] Browser back/forward works
- [ ] Page doesn't reload on navigation

---

## 🐛 Error Testing

### Simulate Errors:

**1. Network Error**
```bash
# Stop server
# Refresh page
# Should show "Failed to load markets"
```

**2. Invalid Trade**
```javascript
// Try to create trade with size > MAX_TRADE_SIZE
// Should reject with error message
```

**3. Database Error**
```bash
# Delete database while running
rm database/polymarket.db
# Should recreate automatically
```

---

## 📊 Performance Testing

### Load Times:
- [ ] Initial page load < 2 seconds
- [ ] Markets load < 3 seconds
- [ ] Edge detection completes < 10 seconds
- [ ] Trade execution < 1 second
- [ ] Tab switching < 100ms

### Memory Usage:
```bash
# Check memory in Chrome DevTools
# Should be < 100MB for dashboard
```

---

## ✅ Production Readiness Checklist

Before using with real credentials:

- [ ] Test all features in demo mode
- [ ] Verify edge detection logic
- [ ] Test trade validation
- [ ] Review position sizing
- [ ] Understand risk parameters
- [ ] Set appropriate MAX_TRADE_SIZE
- [ ] Set appropriate MIN_EDGE_THRESHOLD
- [ ] Keep AUTO_TRADE_ENABLED=false initially
- [ ] Monitor logs for errors
- [ ] Test with small amounts first

---

## 🎯 Success Criteria

The dashboard is working correctly if:

1. ✅ All tabs load without errors
2. ✅ Markets display with accurate data
3. ✅ Edge detection finds opportunities
4. ✅ Trades can be created and tracked
5. ✅ P&L charts display correctly
6. ✅ News feed loads and updates
7. ✅ Modal opens/closes smoothly
8. ✅ No console errors
9. ✅ Auto-refresh works
10. ✅ Responsive design works

---

## 📝 Test Results Template

```
Date: _________
Tester: _________

Markets Tab:        ✅ / ❌
Edge Detection:     ✅ / ❌
Trade Modal:        ✅ / ❌
Trades Tab:         ✅ / ❌
P&L Tab:           ✅ / ❌
News Feed:         ✅ / ❌
Auto-Refresh:      ✅ / ❌
Performance:       ✅ / ❌

Notes:
_______________________
_______________________
_______________________
```

---

## 🆘 Troubleshooting

### Markets not loading?
1. Check server is running
2. Check console for errors
3. Verify Polymarket API is accessible
4. Try refreshing the page

### Edge opportunities empty?
1. Click "Refresh Edge Detection"
2. Wait 5-10 seconds
3. Check MIN_EDGE_THRESHOLD (lower it for testing)
4. Verify markets loaded first

### Trades not appearing?
1. Check Trades tab after placing trade
2. Verify database/polymarket.db exists
3. Check server logs for errors
4. Try restarting server

### Charts not rendering?
1. Check Chart.js loaded (view source)
2. Check console for Chart errors
3. Verify P&L data exists
4. Try clearing browser cache

---

**Happy Testing! 🚀**

