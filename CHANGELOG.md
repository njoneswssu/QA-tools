# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-03-17

### Added

- Initial release as standalone project (moved out of playwrightautomation).
- NiceGUI app with Supreme-style red/white layout.
- Load unreleased product links from Supreme seasonal preview (Playwright).
- Product and size selection; add to cart with human-like delays.
- Browser stays open 5 minutes after add-to-cart for checkout/captcha.
- Versioning via `pyproject.toml` and `supreme_checkout.__version__`.
- Console script entry point: `supreme-checkout`.
- `CHANGELOG.md` for version history.
