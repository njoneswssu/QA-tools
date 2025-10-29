# Website Availability Tester

A user-friendly macOS application for testing website availability and functionality using Playwright automation.

## Features

- 🌐 **Wildlink Integration**: Automatically scrape merchants from Wildlink platform
- 🎯 **Smart Detection**: Automatically detects unavailable websites using multiple patterns
- 💾 **Merchant Tracking**: Remembers tested merchants to avoid redundant testing
- ⏸️ **Pause/Resume**: Full control over testing process
- 📊 **Real-time Progress**: Live updates and statistics
- 📋 **Detailed Results**: Comprehensive reporting with export functionality
- 🔄 **Multiple Input Formats**: Supports various merchant input formats
- 📱 **Responsive UI**: Resizable window with adaptive layout
- 🖥️ **Multi-Browser Support**: Test merchants across Chrome, Safari, Edge, and Mobile Safari

## Input Formats Supported

The app accepts merchants in multiple formats:

```
Store Name, https://example.com
Store Name - https://example.com
https://example.com
example.com
{"name": "Store Name", "url": "https://example.com"}
```

## Installation

1. Download the `.dmg` file from releases
2. Open the `.dmg` file
3. Drag the app to your Applications folder
4. Launch the app from Applications

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for macOS
npm run build-mac
```

### Building DMG

```bash
# Build and create DMG
npm run dist
```

The built `.dmg` file will be available in the `dist` folder.

## Usage

### Option 1: Load from Wildlink (Recommended)
1. **Click "🌐 Load from Wildlink"**: Opens the Wildlink integration panel
2. **Select Application**: Choose from applications like Acorns, Citi, Microsoft, etc.
3. **Choose Browsers**: Select which browsers to test (Chrome, Safari, Edge, Mobile Safari)
4. **Load Merchants**: Click "📥 Load Merchants" to automatically populate the list
5. **Start Testing**: Begin testing with the loaded merchants

### Option 2: Manual Entry
1. **Enter Merchants**: Paste or type merchant information in the text area
2. **Start Testing**: Click "Start Testing" to begin the automated process

### Testing Controls
3. **Monitor Progress**: Watch real-time progress and statistics
4. **Control Testing**: Use Pause/Resume/Stop buttons as needed
5. **View Results**: Check results in the tabbed interface
6. **Export Data**: Save results to JSON for further analysis

## Features in Detail

### Smart Merchant Tracking
- Automatically saves tested merchants with timestamps
- Skips merchants tested within the last 24 hours
- Option to clear history and force retest

### Comprehensive Detection
- Multi-language unavailability pattern detection
- E-commerce functionality verification
- Network error handling
- Minimal content detection

### Wildlink Integration
- Automatically discovers applications (Acorns, Citi, Microsoft, etc.)
- Scrapes merchants for each application and browser combination
- Supports Chrome, Safari, Edge, and Mobile Safari testing
- Eliminates manual merchant list creation

### User-Friendly Interface
- Clean, modern macOS-style interface
- Responsive design that adapts to window size
- Resizable and movable windows
- Real-time progress updates
- Tabbed results view (All/Available/Unavailable)
- Export functionality for results

## Technical Details

- Built with Electron for cross-platform compatibility
- Uses Playwright for robust web automation
- Implements secure IPC communication
- Persistent data storage for merchant tracking

## License

MIT License - see LICENSE file for details
