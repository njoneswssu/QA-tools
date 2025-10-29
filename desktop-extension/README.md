# CitiShop Desktop Extension

A modern desktop application that allows users to dynamically input and test merchants for CitiShop automation using Playwright.

## Features

🎯 **Dynamic Merchant Input**: Enter merchants through a beautiful interface instead of hardcoding them
🔍 **Real-time Validation**: Validate merchant names against the CitiList.txt database
📊 **Live Test Execution**: Monitor Playwright tests in real-time with progress tracking
📈 **Session Statistics**: Track your testing sessions with detailed metrics
🎨 **Modern UI**: Beautiful, responsive interface with dark mode support

## Installation

### Prerequisites

1. **Node.js** (v16 or higher)
2. **Playwright** (already installed in the parent project)
3. **CitiShop Extension** (should be available in the specified path)

### Setup

1. **Navigate to the desktop extension directory**:
   ```bash
   cd /Users/neiljones/Documents/playwrightautomation/desktop-extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Electron globally** (optional, for easier development):
   ```bash
   npm install -g electron
   ```

## Usage

### Starting the Application

**Development Mode** (with DevTools):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

### Using the Application

1. **Enter Merchants**: 
   - Type merchant names in the text area (comma-separated)
   - Example: `Ulta, Best Buy, Macy's, Sephora`
   - Or click "Load Sample" for example merchants

2. **Validate Merchants**:
   - Click "Validate Merchants" or press `Ctrl+Enter`
   - View found/not found merchants
   - Only found merchants will be tested

3. **Run Tests**:
   - Click "Run Test with Found Merchants"
   - Monitor progress and output in real-time
   - View session statistics

### Keyboard Shortcuts

- `Ctrl+Enter`: Validate merchants
- Standard copy/paste shortcuts work in text areas

## How It Works

### Merchant Validation

The application reads your `citiList.txt` file and parses it to extract merchant names and URLs. When you input merchants, it:

1. Splits your input by commas
2. Trims whitespace from each name
3. Performs case-insensitive matching against the CitiList
4. Returns found merchants with their URLs and lists any not found

### Test Execution

When you run a test, the application:

1. Creates a temporary test file based on your original `quick-citishop-test.spec.js`
2. Replaces the hardcoded `websites` array with your selected merchants
3. Runs the test using Playwright
4. Streams output back to the interface in real-time
5. Cleans up the temporary file when complete

## File Structure

```
desktop-extension/
├── main.js                 # Electron main process
├── package.json           # Dependencies and scripts
├── README.md             # This file
└── renderer/
    ├── index.html        # Main application UI
    ├── styles.css        # Styles and animations
    └── renderer.js       # Frontend logic and IPC
```

## Configuration

### Paths

The application expects these files in specific locations:

- **CitiList**: `../e2e/citiList.txt`
- **Original Test**: `../e2e/quick-citishop-test.spec.js`
- **CitiShop Extension**: `/Users/neiljones/Documents/CitiBuild 1.14`

### Customization

You can modify paths in `main.js`:

```javascript
// Change CitiList path
const citiListPath = path.join(__dirname, '..', 'e2e', 'citiList.txt');

// Change extension path in createTempTestFile function
const pathToExtension = path.join('/Users/neiljones/Documents/CitiBuild 1.14');
```

## Building for Distribution

To create a distributable app:

```bash
npm run build
```

This will create installers in the `dist/` directory.

## Troubleshooting

### Common Issues

1. **"Failed to load merchant list"**
   - Check that `citiList.txt` exists in the correct location
   - Verify the file has the correct format with name/URL pairs

2. **Test execution fails**
   - Ensure Playwright is installed in the parent directory
   - Check that the CitiShop extension path is correct
   - Verify the original test file exists

3. **Application won't start**
   - Run `npm install` to ensure all dependencies are installed
   - Check Node.js version (should be v16+)

### Debug Mode

Run in development mode to see detailed logs:
```bash
npm run dev
```

This opens DevTools where you can see console logs and debug issues.

## Development

### Adding Features

The application uses Electron's main/renderer architecture:

- **main.js**: Backend logic, file operations, test execution
- **renderer.js**: Frontend logic, UI interactions
- **index.html/styles.css**: User interface and styling

### IPC Channels

Communication between main and renderer processes:

- `load-merchant-list`: Load and parse CitiList.txt
- `validate-merchants`: Validate input against merchant list
- `run-test`: Execute Playwright test with selected merchants
- `test-output`: Stream test output to UI
- `test-error`: Stream test errors to UI

## Security

[[memory:5286018]] Sensitive information is properly handled:

- No billing or card information is logged
- Merchant URLs are validated before use
- Temporary files are cleaned up after test execution

## License

MIT License - Feel free to modify and distribute.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs in DevTools
3. Ensure all prerequisites are met
