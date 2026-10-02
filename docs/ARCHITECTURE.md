# RoV LAB — Architecture

> Last reviewed: 2026-10-02

## Overview

RoV LAB is a community-oriented RoV data and analysis application built with:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn-style UI components
- Lucide icons
- React Router
- Supabase
- Vercel

The application combines curated game data, derived statistics, heuristic analysis, community features, and AI-assisted analysis.

## Main Layers

Typical responsibilities are organized as follows:

- `src/pages/*` — route-level pages
- `src/features/*` — feature-specific UI and logic
- `src/components/*` — reusable UI components
- `src/layouts/*` — application shells and shared page structure
- `src/services/*` — data-access and domain services
- `src/types/*` — shared TypeScript/domain types
- `src/data/*.mock.ts` — mock/demo data
- `supabase/functions/*` — server-side Edge Functions
- `supabase/schema.sql` — database schema reference
- `supabase/migrations/*` — database migrations

## AppShell

`AppShell` is responsible for the shared application frame.

Current responsibilities include:

1. Desktop sidebar
2. Header
3. Route content via React Router `Outlet`
4. Mobile bottom navigation
5. Mobile navigation drawer
6. Route-content remount behavior when the selected rank bucket changes

The site footer should remain part of `AppShell` so legal, attribution, and project information are consistently available across the application.

## Main Routes

The application currently includes or is designed around routes such as:

- `/`
- `/heroes`
- `/heroes/:slug`
- `/tier-list`
- `/stats`
- `/counter-pick`
- `/matchup`
- `/draft`
- `/build`
- `/learn`
- `/learn/:slug`
- `/favorites`
- `/profile`
- `/players/:id`
- `/login`
- `/admin`

Routes may change as the project evolves. When adding or removing major routes, update this document.

## Data Flow

The preferred data flow is:

```text
Page / Feature
      ↓
Service / Domain Logic
      ↓
Supabase or Mock Source
      ↓
Typed Domain Data
      ↓
UI
```

Pages and feature components should avoid embedding large amounts of database/query logic directly in presentation components when a service layer is appropriate.

## Supabase

Supabase is used for:

- PostgreSQL database
- Authentication
- Row Level Security (RLS)
- Storage
- Edge Functions

Important Edge Functions include:

- `ai-coach`
- `avatar`

Admin authorization uses the project's admin database logic, including `admin_users` and the `is_admin()` mechanism where applicable.

## Design Principles

### Mobile first

The application should work well on:

- Mobile
- Tablet
- Desktop

Do not design desktop-only interactions for core functionality.

### Reuse the design system

Prefer existing:

- Tailwind tokens
- shadcn-style components
- shared UI components
- Lucide icons

Avoid introducing new dependencies for functionality that the existing stack can already provide.

### Preserve routes and authentication

Feature work should avoid unintentionally breaking:

- existing URLs
- authentication
- Supabase queries
- RLS behavior
- mobile navigation

### Keep secrets server-side

Private API keys must never be exposed through client-side `VITE_*` environment variables.

### Do not disguise non-official data

Mock, heuristic, derived, community, and AI-generated information must not be presented as official game data.

## Documentation Maintenance

When architecture changes significantly, update:

- `README.md`
- this document
- relevant feature documentation
- database documentation if schema/data flow changes
- roadmap if the change affects planned work
