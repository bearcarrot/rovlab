# RoV LAB — Data Sources

> Last reviewed: 2026-10-02

This document records where RoV LAB data comes from and how its reliability/provenance should be communicated.

## Data Status Vocabulary

| Status | Meaning |
|---|---|
| Official | Directly published by the game publisher/rightsholder or an official game service |
| Curated | Manually collected, checked, and maintained by the RoV LAB project |
| Community | Submitted or maintained by users/community members |
| Derived | Calculated from other stored data |
| Heuristic | Produced by rules, scoring logic, or estimates rather than an authoritative source |
| AI-generated | Produced or assisted by an AI model |
| Mock | Placeholder/demo data used while a real data source is not implemented |

These categories describe provenance, not a guarantee that a dataset is correct.

## Current Data Map

The following snapshot reflects the project documentation and should be rechecked against the live database before being treated as current.

| Dataset | Storage / Source | Status | Notes |
|---|---|---|---|
| Heroes | Supabase | Curated | README previously reported 129 heroes with icons |
| Hero abilities | Supabase | Curated | README previously reported 516 ability rows |
| Hero stats | Supabase | Derived | Current UI reads latest patch data and selected rank bucket |
| Hero counters | Supabase | Curated | Manually maintained matchup relationships |
| Hero synergies | Supabase | Curated | Dataset was previously sparse |
| Items | Supabase | Curated | README previously reported 112 items with images |
| Arcana | Supabase | Curated | README previously reported 30 level-3 arcana |
| Item builds | Supabase + logic | Curated / Heuristic | May combine stored builds with fallback logic |
| Matchups | Application logic | Mock / Heuristic | Real Supabase matchup data was previously incomplete |
| Guides | Application logic | Mock | Real guide dataset was previously incomplete |
| Home insights | Application logic | Mock | Placeholder insights |
| Draft analysis | Application logic | Derived / Heuristic / Curated | Combines counters, synergies, draft context and rules |
| Coach Ai | Supabase Edge Function | AI-generated | Analysis generated from supplied game/project data |
| Item images | External CDN / hotlinks | External asset | Verify current URL and usage rights |
| Rune images | Garena Thailand CDN | External asset | Verify URL availability when changing data |
| Rune stats | Third-party historical source | Third-party | Historical data must not automatically be treated as current |

## Source Attribution

When practical, datasets should retain enough provenance to answer:

- Where did this data come from?
- When was it last checked?
- Which patch/version does it represent?
- Is it official, curated, derived, heuristic, community, or AI-generated?

Potential future metadata fields include:

```text
source
source_url
source_type
last_verified_at
patch_version
data_status
```

Do not add these fields blindly. First inspect the live Supabase schema and existing application queries.

## Source URL Rules

- Do not invent source URLs.
- Prefer first-party sources for official game facts when available.
- Use third-party sources when necessary, but label them appropriately.
- Preserve source attribution when importing external data.
- Do not imply that an external image or asset is owned by RoV LAB.
- If licensing or permission is unclear, verify it rather than assuming permission.

## Important Distinction

A source being useful does not automatically make every value from that source official.

For example:

- A community database may contain useful hero information.
- A third-party website may contain useful item information.
- A calculated counter score may be derived from project data.
- An AI response may combine several datasets.

These should retain their appropriate provenance.

## Maintenance

Whenever a major dataset is updated:

1. Identify the source.
2. Record the patch/version where applicable.
3. Check for duplicates and conflicts.
4. Update the canonical database.
5. Update this document if the source/status changed.
6. Avoid silently converting estimates or heuristics into official-looking facts.
