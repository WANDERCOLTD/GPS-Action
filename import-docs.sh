#!/usr/bin/env bash
#
# GPS Action — Documentation Import
# =========================================================================
# Moves markdown files from docs-staging/ to their proper paths.
# Run from project root after dropping files into docs-staging/.
# =========================================================================

set -euo pipefail

if [ ! -d docs-staging ]; then
  echo "✗ No docs-staging/ directory found."
  echo "  Run this from the project root."
  exit 1
fi

cd docs-staging

# ─── Mapping: source filename → destination path ───────────────────────────
declare -A MAPPING=(
  ["GPS_Action_Documentation_Index.md"]="../docs/index.md"
  ["GPS_Action_Parking_Lot.md"]="../docs/product/parking-lot.md"
  ["GPS_Action_Scenarios.md"]="../docs/product/scenarios.md"
  ["GPS_Action_Session_Brief_Template.md"]="../docs/process/session-brief-template.md"
  ["GPS_Action_Reviewer_Checklist.md"]="../docs/process/reviewer-checklist.md"
  ["GPS_Action_Security_Baseline.md"]="../docs/process/security-baseline.md"
  ["GPS_Action_Ratchet_Discipline.md"]="../docs/process/ratchet-discipline.md"
  ["GPS_Action_Decision_Log.md"]="../docs/architecture/decision-log.md"
  ["GPS_Action_Change_Absorption_Guide.md"]="../docs/process/change-absorption-guide.md"
  ["gps-tokens.css"]="../styles/tokens.css"
  ["gps-components.css"]="../styles/components.css"
  ["GPS_Action_Design_Guide.pdf"]="../docs/design-system/design-guide.pdf"
  ["GPS_Action_Mood_Board.html"]="../docs/design-system/mood-board.html"
)

MOVED=0
SKIPPED=0

for src in "${!MAPPING[@]}"; do
  dst="${MAPPING[$src]}"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    mv "$src" "$dst"
    echo "→ $src → $dst"
    MOVED=$((MOVED + 1))
  else
    echo "  (not found: $src — skipped)"
    SKIPPED=$((SKIPPED + 1))
  fi
done

# ─── Feature spec — handle both .md and .docx ─────────────────────────────
if [ -f "GPS_Action_Feature_Spec_v0.5.md" ]; then
  mv "GPS_Action_Feature_Spec_v0.5.md" "../docs/feature-spec/v0.5.md"
  echo "→ GPS_Action_Feature_Spec_v0.5.md → ../docs/feature-spec/v0.5.md"
  MOVED=$((MOVED + 1))
elif [ -f "GPS_Action_Feature_Spec_v0.5.docx" ]; then
  mv "GPS_Action_Feature_Spec_v0.5.docx" "../docs/feature-spec/v0.5.docx"
  echo "→ GPS_Action_Feature_Spec_v0.5.docx → ../docs/feature-spec/v0.5.docx"
  echo "  NOTE: keep as docx for reference; convert to md when ready"
  MOVED=$((MOVED + 1))
fi

echo ""
echo "✓ Imported $MOVED files. $SKIPPED not found."

# ─── Clean up staging if empty ─────────────────────────────────────────────
cd ..
if [ -z "$(ls -A docs-staging/ | grep -v README.md || true)" ]; then
  echo ""
  read -p "Remove now-empty docs-staging/ directory? [y/N] " response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    rm -rf docs-staging
    echo "✓ docs-staging/ removed"
  fi
fi
