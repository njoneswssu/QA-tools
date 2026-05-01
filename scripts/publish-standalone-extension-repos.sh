#!/usr/bin/env bash
# Creates public GitHub repos under your authenticated account and publishes releases.
# Prerequisites: brew install gh && gh auth login
# Optional: GH_USER=YourLogin if repos should live under a different owner (org or user).
set -euo pipefail

ROOT="${STANDALONE_REPO_ROOT:-$HOME/playwright-standalone-repos}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh" >&2
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login -h github.com -p ssh -w" >&2
  exit 1
fi

if [[ -z "${GH_USER:-}" ]]; then
  GH_USER="$(gh api user -q .login)"
fi
if [[ -z "$GH_USER" ]]; then
  echo "Could not resolve GitHub login. Run: gh auth login -h github.com" >&2
  exit 1
fi
echo "Using GitHub owner: $GH_USER" >&2

# gh repo create USER/REPO when USER is your own login can return HTTP 404 on /users/USER; use short REPO for personal accounts.
GH_ME="$(gh api user -q .login)"

if [[ ! -d "$ROOT/lowes-promo-tester-extension/.git" ]]; then
  echo "Missing standalone repos at $ROOT" >&2
  echo "Copy from your machine or re-run the export step (see agent notes)." >&2
  exit 1
fi

push_create_or_push() {
  local name="$1"
  local dir="$ROOT/$name"
  cd "$dir"
  if gh repo view "${GH_USER}/${name}" >/dev/null 2>&1; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "git@github.com:${GH_USER}/${name}.git"
    git push -u origin main
  else
    if [[ "$GH_USER" == "$GH_ME" ]]; then
      gh repo create "$name" --public --source=. --remote=origin --push
    else
      gh repo create "${GH_USER}/${name}" --public --source=. --remote=origin --push
    fi
  fi
}

release_with_assets() {
  local name="$1"
  local tag="$2"
  local title="$3"
  shift 3
  local assets=("$@")
  cd "$ROOT/$name"
  if gh release view "$tag" >/dev/null 2>&1; then
    echo "Release $tag already exists for $name; skipping."
    return 0
  fi
  gh release create "$tag" --title "$title" --notes "$title — Chrome extension / kit from QA-tools split." "${assets[@]}"
}

push_create_or_push lowes-promo-tester-extension
push_create_or_push merchant-rate-weekly-report
push_create_or_push xml-converter-extension

ART="$ROOT/artifacts"
release_with_assets lowes-promo-tester-extension v1.0.0 "Lowe's Promo Tester v1.0.0" \
  "$ART/lowes-promo-tester-extension-v1.0.0.zip"
release_with_assets merchant-rate-weekly-report v1.6.3 "Merchant rate weekly report v1.6.3" \
  "$ART/merchant-rate-weekly-report-extension-v1.6.3.zip" \
  "$ART/merchant-rate-weekly-report-full-v1.6.3.zip"
release_with_assets xml-converter-extension v1.0.0 "XML Order Status Converter v1.0.0" \
  "$ART/xml-order-status-converter-v1.0.0.zip"

echo "Done. Repos: https://github.com/${GH_USER}/lowes-promo-tester-extension"
echo "             https://github.com/${GH_USER}/merchant-rate-weekly-report"
echo "             https://github.com/${GH_USER}/xml-converter-extension"
