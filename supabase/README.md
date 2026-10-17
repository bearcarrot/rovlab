# Supabase notes

- **`schema.sql` is an old MVP baseline, not a replayable schema.** It predates the renames to `carry` / `rune` / `roaming` and does not contain tables added later (e.g. `match_results`). Do not build a new database from it alone.
- **The source of truth is `migrations/`**, applied to the live project in filename order (SQL editor / MCP). Before relying on a fresh environment, dump the real schema from the live project.
- **Migration filenames are not Supabase CLI compatible.** Several files share one version prefix (e.g. `20261010_*`, `20261003_*`) and some use a letter suffix (`20261014b_*`). `supabase db push` would reject or skip them. Do not rename already-applied files: that would desync whatever history the live project tracks. If the CLI is adopted later, baseline from a dump instead.
- New migrations: use a unique `YYYYMMDDHHMMSS_name.sql` prefix.
