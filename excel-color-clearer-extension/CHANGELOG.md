# Changelog

All notable changes to the Excel Color Clearer extension will be documented in this file.

## [1.2.0] - 2026-01-14

### Added
- 🔄 **Smart Retry Logic**: Extension now waits for Excel API to load (up to 10 seconds)
- ✅ **Better Status Messages**: Shows whether Excel is detected and ready
- 💡 **Tips Section**: Added collapsible troubleshooting tips in popup
- 📖 **Troubleshooting Guide**: New comprehensive TROUBLESHOOTING.md file

### Changed
- Improved Excel API detection with actual API test (not just existence check)
- Enhanced error messages with actionable suggestions
- Content script now waits for Excel to be fully initialized
- Popup shows success message when Excel is ready

### Fixed
- ❌ **Fixed**: "Excel API not available" when API is still loading
- ❌ **Fixed**: Better handling of view-only vs edit mode
- ❌ **Fixed**: More reliable detection on SharePoint pages

## [1.1.1] - 2026-01-14

### Added
- 🏢 **Hunter Douglas SharePoint**: Added explicit support for `hunterdouglasna.sharepoint.com`

### Changed
- Updated manifest to include specific Hunter Douglas SharePoint domain
- Enhanced URL detection for corporate SharePoint instances

## [1.1.0] - 2026-01-14

### Added
- 💾 **Persistent Storage**: Hex code and settings are now saved and restored when you reopen the extension
- 🌐 **Excel Cloud Support**: Added support for `excel.cloud.microsoft` domain
- ⚙️ **Remember Settings**: Checkbox preferences (Process all sheets, Confirm before clearing) are now saved

### Changed
- Updated manifest to include `storage` permission for saving preferences
- Enhanced URL detection to include all Excel Online domains
- Improved user experience with persistent form state

### Fixed
- ❌ **Fixed**: Hex code now persists when closing and reopening extension
- ❌ **Fixed**: SharePoint Excel links using excel.cloud.microsoft domain now supported

## [1.0.0] - 2026-01-14

### Added
- 🎨 Initial release
- Clear cells by hex color code
- Process single sheet or all sheets
- Live color preview
- Optional confirmation dialog
- Detailed results per sheet
- Support for office.com, live.com, and sharepoint.com
- Modern gradient UI
- SVG icons
- Comprehensive documentation

### Features
- Hex code input with validation
- Real-time color preview
- Excel JavaScript API integration
- Safe operation (only changes colors)
- Cross-browser compatible (Chrome, Edge, Firefox)

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

## Links

- [README](README.md) - Full documentation
- [INSTALLATION](INSTALLATION.md) - Installation guide
- [QUICK_START](QUICK_START.md) - Quick start guide

