# RoV LAB — Database

> Last reviewed: 2026-10-02

## Important Note

The repository schema is not guaranteed to be a complete reproduction of the current live Supabase database.

Some tables or columns may have been created or changed directly in Supabase and may not yet be fully represented by committed migrations.

Examples previously identified include:

- `admin_users`
- `hero_roles`
- `hero_lanes`
- `item_build_arcana`
- `arcana.color`

Before rebuilding or making destructive schema changes, compare:

- the live Supabase schema
- `supabase/schema.sql`
- `supabase/migrations/*`
- application queries
- TypeScript types

## Domain Map

### Heroes

Typical tables:

- `heroes`
- `hero_roles`
- `hero_lanes`

### Abilities

- `hero_abilities`

### Statistics

- `hero_stats`
- `patches`

### Matchups

- `hero_counters`
- `hero_synergies`

### Items

- `items`

### Arcana

- `arcana`

### Builds

- `item_builds`
- `item_build_items`
- `item_build_arcana`

### Tier Lists

- `tier_lists`
- `tier_list_entries`

### Community

Examples include:

- `comments`
- favorites/profile-related tables

### Administration

- `admin_users`

## Historical Snapshot

The following numbers came from the project documentation and are snapshots, not guaranteed current counts:

| Dataset | Previously reported count |
|---|---:|
| Heroes | 129 |
| Hero abilities | 516 |
| Hero stats | 258 |
| Hero counters | 387 |
| Hero synergies | 1 |
| Items | 112 |
| Level-3 arcana | 30 |
| Item builds | 2 |
| Item rows in one build-related snapshot | 10 |
| Build-arcana rows | 7 |
| Tier lists | 12 |
| Tier-list entries | 516 |

Always query the live database before relying on these numbers.

## Row Level Security

RLS should remain enabled where required.

Any database change must consider:

- guest access
- authenticated-user access
- admin access
- write permissions
- service-role-only operations

Do not weaken RLS simply to make a frontend query work.

## Admin Access

Admin-only operations should continue to use the project's existing admin authorization mechanism.

Do not rely solely on hiding UI buttons. Database policies and server-side checks must also protect privileged operations.

## Schema Changes

For durable schema changes:

1. Inspect the current live schema.
2. Check existing migrations.
3. Prefer a new migration over an undocumented manual change.
4. Update application types and queries.
5. Test RLS.
6. Update this document.

## Source Attribution

If future schema work adds source/provenance information, design it deliberately.

Possible fields include:

```text
source
source_url
source_type
patch_version
last_verified_at
data_status
```

Do not scatter source fields across unrelated tables without considering normalization and query requirements.
