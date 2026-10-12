RoV LAB

Your Arena of Valor Companion — Draft Smarter. Build Better. Play to Win.

RoV LAB is a community-driven companion platform for Arena of Valor (RoV) players. It brings hero information, tier lists, draft planning, counter picks, builds, game data, community contributions, and AI-assisted analysis together in one place.

🌐 Live Website: rovlab.vercel.app

⸻

Table of Contents

* Overview
* Features
* Technology Stack
* Project Structure
* Getting Started
* Environment Variables
* Available Scripts
* Database and Data Management
* AI and Game Analysis
* Performance and Security
* Development Guidelines
* Contributing
* Disclaimer

⸻

Overview

RoV LAB aims to help players make better decisions before, during, and after a match.

The platform focuses on four key areas:

* Research: Explore heroes, roles, skills, items, runes, and other game data.
* Strategy: Evaluate matchups, counter picks, team compositions, and draft decisions.
* Builds: Create, manage, discover, and share item and rune builds.
* Analysis: Use AI-assisted tools to interpret draft situations and match results.

The project is designed with a responsive interface for mobile, tablet, and desktop users.

Features

Hero Database

Explore the RoV hero roster and access hero-related information.

* Hero list and individual hero pages.
* Hero roles and relevant gameplay information.
* Hero skills and associated data.
* Hero selection for draft planning and matchup analysis.
* Integration with other features that require hero information.

Tier List

Explore and organize heroes by their perceived strength and suitability for different roles.

* Role-based tier list views.
* Hero tier organization.
* Shareable tier list pages and URLs.
* Social sharing support.
* Custom tier list functionality, where available.

Tier lists are intended to support player decisions and should not be interpreted as official game rankings.

Counter Pick and Matchup

Tools for evaluating hero matchups and potential counters.

* Select opposing heroes.
* Identify potential counter picks.
* Compare matchup information.
* Evaluate possible hero selections before a match.

Recommendations should be interpreted alongside player skill, team composition, game updates, and individual playstyle.

Draft Assistant

Plan hero selections and bans before entering a match.

* Select enemy heroes for analysis.
* Explore potential counter picks.
* Consider team synergy and composition.
* Review hero recommendations and relevant risk factors.
* Share draft configurations through supported URLs.

The goal is to help players understand their options rather than rely on a single recommendation.

Draft Series and Global Ban/Pick

Draft-oriented tools for exploring hero selection strategies and team compositions.

* Plan pick and ban sequences.
* Review draft scenarios.
* Explore hero combinations and strategic alternatives.
* Use draft-related sharing features where supported.

Item Builds

Create and explore item configurations for heroes.

* Manage item builds.
* Select items from the game database.
* Organize item selection by shop tier.
* Support item selection and build editing workflows.
* View and share supported builds.
* Support community-created builds where available.

The item selection interface follows the in-game shop concept, organizing Tier 1, Tier 2, and Tier 3 items into separate groups.

Rune Builds

Manage rune configurations for different heroes and playstyles.

* Select runes from the game database.
* Organize rune configurations.
* Create and edit builds.
* Support build viewing and sharing where available.

Game Data

Maintain structured game data used by the platform.

Game data categories may include:

* Items
* Runes
* Challenger Skills
* Enchantments
* Heroes and hero-related data

Administrative workflows are intended to make game data easier to manage and keep consistent across player-facing features.

Community

Community-oriented features help players discover and share information.

Depending on the enabled functionality, these may include:

* Community builds.
* Shared tier lists and draft configurations.
* User profiles.
* Favorites.
* Community feed and notifications.
* Player activity and contributions.

Coach AI

RoV LAB includes an AI-assisted coaching experience intended to help players reason about gameplay and draft decisions.

Potential use cases include:

* Understanding draft situations.
* Exploring hero choices and counters.
* Evaluating team composition.
* Receiving context-aware suggestions.
* Accessing recommendations related to the current page or selected heroes.

AI output is advisory and may be inaccurate. Recommendations should be checked against current game data and actual match conditions.

Match Analysis

The project includes work toward screenshot-based match analysis.

The intended workflow is to extract relevant information from a match result screenshot, such as:

* Match result and duration.
* Player and hero names.
* Kill, death, and assist statistics.
* Gold and other visible statistics.
* MVP or performance ratings.
* Item builds, when the screenshot provides sufficient detail.

Extracted information can then be matched against the game’s structured data for further analysis.

Note: OCR accuracy depends on screenshot quality, layout, text clarity, and the recognition pipeline. Fields that cannot be identified reliably should not be treated as confirmed data.

Administration

Administrative tools support the management of platform content and game data.

Depending on the enabled modules, administrative workflows may include:

* Game data management.
* Item and rune build management.
* Build creation and editing.
* Hero-related configuration.
* Community content moderation.
* User and activity management.

Administrative actions must be protected by appropriate authentication and authorization checks.

⸻

Technology Stack

The project uses a modern web application stack.

Technology	Purpose
React	User interface
TypeScript	Type safety
Vite	Development server and build tooling
Tailwind CSS	Styling
shadcn/ui	Reusable interface components
Lucide	Icons
Supabase	Database and backend services
Supabase Auth	Authentication, where configured
Supabase Edge Functions	Server-side functionality
Google Gemini	AI-powered features, where configured
Vercel	Hosting and deployment

The exact dependencies and scripts are defined in package.json. Supabase configuration, database migrations, and Edge Functions should be reviewed in the repository before deployment.

⸻

Project Structure

The following is a conceptual overview. Actual paths and module names may change as the project evolves.

rovlab/
├── public/                 # Static assets
├── src/
│   ├── components/         # Shared UI components
│   ├── pages/              # Application pages
│   ├── services/           # API and service integrations
│   ├── hooks/              # Shared React hooks
│   ├── lib/                # Utilities and integrations
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Application routes
│   └── main.tsx            # Application entry point
├── supabase/
│   ├── functions/          # Edge Functions
│   └── migrations/         # Database migrations, if present
├── docs/                   # Project documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md

Use the actual repository structure as the source of truth when locating or modifying files.

⸻

Getting Started

Prerequisites

Make sure the following are available:

* Node.js version compatible with the project’s dependencies.
* npm.
* Access to the required Supabase project.
* Environment variables for the services enabled in your environment.

1. Clone the repository

git clone https://github.com/bearcarrot/rovlab.git
cd rovlab

2. Install dependencies

npm install

3. Configure environment variables

Create a .env.local file in the project root and configure the required variables.

See Environment Variables.

4. Start the development server

npm run dev

Vite will print the local development URL in the terminal.

5. Run validation and build

npm run typecheck
npm run lint
npm run build

Only run commands that exist in the current package.json. If a script is unavailable, inspect the package configuration before adding or changing it.

⸻

Environment Variables

Client-side Vite variables use the VITE_ prefix.

Typical variables used by the application include:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Use the exact variable names expected by the current source code and deployment configuration.

Security Notes

* Never expose a Supabase service_role key in client-side code.
* Never place database passwords, private API keys, or server secrets in VITE_ variables.
* Configure sensitive values in Supabase Edge Function secrets or the appropriate server-side environment.
* Do not commit .env.local or other files containing secrets.
* Apply appropriate Row Level Security (RLS) policies to Supabase tables.
* Verify authentication and authorization on the server for privileged operations.

⸻

Available Scripts

Check package.json for the definitive list of scripts.

Common scripts in a Vite project include:

npm run dev
npm run build
npm run preview

The project may also define:

npm run typecheck
npm run lint

Use the scripts actually configured in the repository. A successful local build does not by itself verify production environment variables, database permissions, Edge Functions, or live application behavior.

⸻

Database and Data Management

Supabase is used for the application’s structured data and backend services.

Game data should remain consistent across all features that depend on it, including:

* Hero pages.
* Draft Assistant.
* Counter Pick and Matchup.
* Item Builds.
* Rune Builds.
* Challenger Skills and Enchantments.
* Match Analysis.

Data Integrity Principles

* Use stable identifiers and consistent slugs.
* Avoid duplicate records for the same game entity.
* Keep item and rune references consistent across builds.
* Validate foreign-key relationships and required fields.
* Use database migrations for schema changes when the project supports them.
* Confirm that production data and migrations are synchronized before deploying new features.
* Store assets in the intended project storage or asset-management system.
* Avoid unnecessary dependencies on external image URLs when assets are expected to be managed locally or in project storage.

When modifying game data, check all related pages, queries, and relationships before considering the change complete.

⸻

AI and Game Analysis

AI-powered features depend on the configured provider, model availability, server-side implementation, and applicable usage limits.

Recommended Practices

* Keep API credentials on the server.
* Validate user input before sending requests.
* Handle rate limits, timeouts, and provider errors.
* Provide useful fallback messages when AI services are unavailable.
* Avoid presenting generated suggestions as guaranteed game outcomes.
* Distinguish OCR-extracted values from verified database records.
* Track usage and errors without unnecessarily storing sensitive information.

For screenshot analysis, prefer structured output with explicit confidence or validation states when supported. Do not silently convert uncertain OCR results into confirmed match statistics.

⸻

Performance and Security

RoV LAB should remain responsive and reliable across mobile and desktop devices.

Performance

* Avoid unnecessary component re-renders and repeated database requests.
* Load heavy features only when needed.
* Optimize image sizes and use appropriate caching.
* Keep shared components reusable without overcomplicating the architecture.
* Review route-level loading and error states.
* Measure actual page performance before claiming a performance improvement.

Security

* Enforce access control for administrative features.
* Use Supabase RLS policies where appropriate.
* Validate data on both client and server.
* Keep secrets out of the browser bundle and source control.
* Handle user-generated content safely.
* Review permissions before changing database policies or privileged Edge Functions.

⸻

Development Guidelines

RoV LAB is an evolving project. Changes should preserve existing functionality and maintain consistency across related features.

General Rules

1. Inspect the existing implementation before creating new components or services.
2. Reuse established patterns and shared components.
3. Keep the interface responsive and consistent with the current design system.
4. Preserve existing routes, database relationships, and user workflows unless a change explicitly requires otherwise.
5. Use TypeScript types that reflect the actual data schema.
6. Avoid duplicating business logic across pages.
7. Handle loading, empty, success, and error states.
8. Test affected workflows after changing shared functionality.
9. Update documentation when setup requirements or architecture change.
10. Do not claim that a feature is complete until its relevant implementation and behavior have been verified.

Before Merging Changes

Where applicable, verify:

* TypeScript checks.
* Lint checks.
* Production build.
* Mobile and desktop layouts.
* Authentication and authorization.
* Supabase queries and RLS behavior.
* Relevant Edge Functions.
* Existing share URLs and related workflows.
* Production configuration and deployment status.

⸻

Contributing

Contributions should focus on correctness, maintainability, usability, and consistency with the existing architecture.

A typical contribution workflow is:

1. Review the relevant code and project conventions.
2. Make a focused change.
3. Test the affected functionality.
4. Run the available validation scripts.
5. Document any required environment or database changes.
6. Submit a pull request with a clear description of the change and its verification status.

For database changes, include the necessary migration or setup instructions when applicable.

⸻

Disclaimer

RoV LAB is an independent community-oriented project and is not an official Arena of Valor product.

Arena of Valor, its characters, artwork, icons, and other associated assets may belong to their respective owners. Game information and balance may change with updates.

AI-generated advice, tier lists, matchup assessments, and build recommendations are informational tools, not guarantees of match performance.

Users should verify important information against the current game version and applicable official sources.

⸻

RoV LAB — Draft smarter. Build better. Play to win.
