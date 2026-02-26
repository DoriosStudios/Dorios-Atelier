---
name: kz-generate-changelog
description: Gera changelog universal para addons da DoriosStudios (BLOCKS, ITEMS, RECIPES, UI/UX, FLUIDS, BUG FIXES, TECHNICAL CHANGES, THIRD-PARTY / INTEGRATION, TEXTURES, MISC). Invocável como `/changelog [since] [until]`.
argument-hint: "[since] [until]"
user-invokable: true
---

## Purpose
Generate a release changelog between refs/tags for any DoriosStudios addon repository. Output must follow the active conventions from:
- `references/changelog_format.md`
- `references/changelog_v0.7.0.md`

## Behaviour / Rules
- Default behavior:
  - No args: `since` = latest tag, `until` = HEAD.
  - One arg: `since` = latest tag, `until` = provided ref.
  - Two args: explicit `since` and `until`.
- Prefer PR titles and labels when available; fallback to commit messages.
- Detect repository owner/name from local `origin` remote (no hardcoded repo name).
- Use git history and PR metadata as source of truth. Do not ingest existing changelog files as generation input.
- Map PRs/commits into sections using:
  1. `type:` labels when present.
  2. Standard labels (`blocks`, `items`, `recipes`, `ui`, `fluids`, `bug`, `technical`, `integration`, `textures`).
  3. Changed-file path heuristics.
  4. Title keyword heuristics.
  5. Otherwise `MISC`.
- Group and order sections as: BLOCKS, ITEMS, RECIPES, UI/UX, FLUIDS, BUG FIXES, TECHNICAL CHANGES, THIRD-PARTY / INTEGRATION, TEXTURES, MISC.
- Inside each section, group entries by subcategory (`### ...`). Keep `General` always first, then sort remaining subcategories alphabetically.
- Omit empty sections.
- For each entry use: `- Short sentence (PR #123)` or `- Short sentence (commit cd61730)`.
- Generate a concise 1-sentence summary below the version header.
- Keep player-facing sections free from internal-only noise whenever classification allows it.
- Use `scripts/generate.js` for generation.

## Examples
- `/changelog`
- `/changelog v3.2.0`  (generate from latest tag to `v3.2.0`)
- `/changelog v3.1.0 v3.2.0`

## Local execution
- `node .github/skills/kz-generate-changelog/scripts/generate.js`
- `node .github/skills/kz-generate-changelog/scripts/generate.js v1.0.0 HEAD --lang ptbr`
- `node .github/skills/kz-generate-changelog/scripts/generate.js v1.0.0 HEAD --output Upcoming/changelog.generated.md`