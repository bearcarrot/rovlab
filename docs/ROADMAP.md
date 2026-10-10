# RoV LAB — Roadmap

> Last reviewed: 2026-10-10

This roadmap describes project-level work and known gaps. It is not a gameplay ranking.

## Current / Working Areas

The project includes or has been working toward:

- Hero database
- Hero detail
- Hero statistics
- Tier List
- Counter Pick
- Draft Assistant
- Item Build
- Arcana
- Authentication
- Favorites
- Profiles
- Comments
- Admin tools
- Coach Ai
- Match analysis from scoreboard screenshots (`/matches`, see `docs/MATCH_OCR.md`)

## Known Gaps

### Matchup

The matchup feature has historically relied partly on mock and heuristic data.

### Guides

Guide data has historically been incomplete/mock.

### Match Analysis

The scoreboard OCR flow has not been build-checked or tested against real screenshots yet, so its accuracy is unmeasured. Items are not read from the screenshot, Coach Ai does not use saved matches, and there is no Home summary card yet. The screenshot has no per-minute data, so insights are match-level only. Details in `docs/MATCH_OCR.md`.

### Saved Builds / Drafts

Some planned saved-build or saved-draft tables may not yet be used by the application.

### Draft Logic

Draft analysis may still depend partly on roles, heuristics, curated counters, and synergies rather than a complete competitive dataset.

### Item Builds

Curated item builds may remain sparse compared with the full item database.

### Tier List Data

Some tier-list UI may not yet consume the database tier-list tables directly.

### Roles / Lanes

Some filtering may use only a primary role or lane instead of fully modeling multi-role/multi-lane heroes.

### Schema Synchronization

The repository schema/migrations are not guaranteed to be fully synchronized with the live Supabase project.

### Verification

Full browser-level verification, production build verification, and automated regression testing should be run after major changes.

## Suggested Next Work

1. Synchronize database schema and migrations.
2. Add deliberate source/provenance metadata.
3. Verify current item names and item data.
4. Verify current arcana data.
5. Complete hero ability icon/source data.
6. Expand curated builds and synergies.
7. Replace mock features with real datasets.
8. Improve multi-role and multi-lane filtering.
9. Add automated build/lint/browser verification.
10. Add public About, Data Sources, and Legal pages.

## Data Maintenance

Patch-sensitive data should be reviewed after significant game updates.

When updating data:

- identify the source
- identify the patch
- check duplicates
- preserve provenance
- update relevant documentation

## Status Discipline

When a roadmap item is completed:

- update `README.md`
- update the relevant technical/data document
- remove obsolete TODOs
- record any new limitations

Avoid keeping completed work listed as an active gap.
