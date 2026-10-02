# RoV LAB — Contributing Guide

> Last reviewed: 2026-10-02

## General Principle

Changes should preserve the existing architecture, data conventions, responsive UI, authentication, and Supabase security model.

## Code Changes

Before changing a feature:

1. Inspect the relevant page.
2. Inspect related feature components.
3. Inspect services.
4. Inspect types.
5. Check existing shared components.
6. Check related Supabase queries/functions.

Prefer extending existing patterns over introducing a parallel architecture.

## Data Access

Keep database/data-access logic in the service layer where practical.

Avoid placing large Supabase queries directly inside reusable presentation components.

Preserve:

- loading states
- empty states
- error states
- authentication behavior
- responsive behavior

## Data Changes

For every meaningful data update:

1. Identify the source.
2. Identify the patch/version where applicable.
3. Identify the data status.
4. Check duplicates.
5. Check conflicts with existing records.
6. Preserve image/source attribution.
7. Update `DATA_SOURCES.md` when provenance changes.

Do not silently convert estimates, heuristics, or AI-generated values into official-looking facts.

## Database Changes

Before modifying the schema:

1. Inspect the live Supabase schema.
2. Review `supabase/schema.sql`.
3. Review existing migrations.
4. Check application queries and types.
5. Prefer migrations for durable changes.
6. Preserve RLS.
7. Test guest and authenticated access.
8. Test admin-only operations.
9. Update `DATABASE.md`.

## AI Changes

For AI-related changes:

- document model inputs
- keep secrets server-side
- preserve the AI disclaimer
- do not expose API keys in frontend variables
- do not present AI output as official game data
- document important fallback/error behavior

## UI Guidelines

RoV LAB is mobile-first.

Prefer:

- responsive layouts
- reusable components
- existing Tailwind tokens
- shadcn-style components
- Lucide icons
- keyboard-accessible controls
- visible focus states

Avoid unnecessary dependencies when existing project tools can solve the problem.

## Verification

Before submitting a meaningful change, run the project's available checks, such as:

```bash
npm run lint
npm run build
```

Also test the affected flow in a browser when practical.

For database changes, test the relevant Supabase queries and RLS policies.

## Documentation

Update documentation when:

- architecture changes
- database schema changes
- data sources change
- AI behavior changes
- a roadmap item is completed
- an important limitation is discovered

## Commit Message Examples

```text
docs: add data source policy
feat: add AppShell footer
fix: correct item source attribution
data: update hero stats for patch X
refactor: move matchup queries into service layer
```
