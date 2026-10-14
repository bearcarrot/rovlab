RoV LAB

Better Tools, Better Wins
เครื่องมือดี มีชัยไปกว่าครึ่ง

RoV LAB is a community-oriented companion for Arena of Valor (RoV), bringing hero research, draft planning, counter picks, matchup analysis, build sharing, game data, and match analysis together in one web application.

* Live site: https://rovlab.vercel.app
* Repository: https://github.com/bearcarrot/rovlab
* Language: Thai-first experience with English branding

⸻

Table of Contents

* Overview
* Features
* Application Routes
* Technology Stack
* Project Structure
* Getting Started
* Environment Variables
* Available Scripts
* Backend and Data
* AI Coach
* Development Guidelines
* Documentation
* Disclaimer

⸻

Overview

RoV LAB is designed to help players make better-informed decisions before, during, and after a match.

The application combines structured game information with practical tools for analyzing heroes, evaluating matchups, preparing team compositions, managing builds, and reviewing match performance.

The project also supports community participation through user profiles, shared content, feedback, and social features.

Core Principles

* Practicality: Turn game information into useful decisions.
* Clarity: Present complex information in an accessible interface.
* Consistency: Reuse shared components and structured game data.
* Performance: Keep navigation and interactions responsive.
* Maintainability: Separate pages, components, services, and data access.
* Data integrity: Validate imported and user-submitted data before relying on it.

⸻

Features

1. Hero Database

Explore the RoV hero roster and inspect individual hero profiles.

* Browse and search heroes.
* View hero details and available game information.
* Navigate between the hero directory and individual hero pages.
* Use the hero database as a foundation for other analysis tools.

2. Tier List

Organize heroes into tiers to evaluate their relative usefulness.

* View the tier-list interface.
* Work with hero rankings and tier organization.
* Access shared tier-list pages where supported.
* Use the application’s existing hero assets rather than requiring users to upload custom hero icons.

3. Draft Assistant

Plan team compositions and evaluate draft decisions.

* Select heroes for draft scenarios.
* Review team composition and role coverage.
* Evaluate draft considerations using the application’s available heuristics.
* Access shareable draft scenarios where supported.

Draft recommendations are decision-support tools, not guarantees of match outcomes.

4. Counter Pick

Research potential counter picks against opposing heroes.

* Identify possible counter-pick options.
* Use matchup knowledge to inform hero selection.
* Present counter relationships in a format that supports quick decisions.

Counter-pick quality depends on the accuracy and completeness of the underlying game data.

5. Matchup Analysis

Compare heroes and evaluate their interactions.

* Review hero matchups.
* Assess relative strengths and weaknesses.
* Use matchup information to support lane and team-fight decisions.

Actual results can vary with player skill, item builds, team composition, patches, and game conditions.

6. Builds

Explore and manage hero builds.

* Browse available builds.
* View individual build details.
* Access build editing where permitted.
* Share builds through supported application routes.

Build effectiveness depends on the game version, enemy composition, and match situation.

7. Game Data

Browse structured game information through the game-data section.

* Explore supported data categories.
* Open individual data records.
* Use centralized game information across compatible features.

The available categories and fields depend on the data currently maintained by the project.

8. Match Analysis and OCR

Analyze supported match screenshots using the application’s match-analysis workflow.

* Submit supported match images.
* Extract match information through the OCR workflow.
* Review recognized information and analysis results.
* Use the resulting data for match-history and performance-related features where supported.

OCR results may contain recognition errors. Extracted information should be checked before being treated as accurate.

9. Player Profiles

Provide profile and player-related pages for the community.

* View player profile pages.
* Access public user pages through supported handles.
* Display available profile and contribution information.

The information visible on a profile depends on account settings, permissions, and available data.

10. Community Features

Support participation and interaction across the application.

Depending on authentication status and feature availability, community functionality includes:

* User accounts and profiles.
* Favorites.
* Match records.
* Community feed.
* Notifications.
* Comments and reactions on supported content.
* User contributions and shared content.

Authenticated features require a properly configured backend and appropriate access permissions.

11. AI Coach

Provide AI-assisted guidance for game-related questions through the Coach AI feature.

* Offer contextual guidance through the available interface.
* Support predefined quick-question workflows.
* Use configured AI services and backend logic.
* Keep model access and API credentials on the server side.

AI-generated advice can be incomplete or incorrect. Important gameplay recommendations should be evaluated against current game mechanics and reliable data.

12. Administration

Provide administrative pages for managing supported application operations.

Administrative capabilities may include:

* Dashboard and operational views.
* Game-data management and imports.
* User and community administration.
* Contact submissions.
* Coach AI feedback and related records.

Administrative access must be enforced by the backend and appropriate authorization policies, not merely by hiding interface elements.

⸻

Application Routes

The following table summarizes the main routes defined by the application’s routing structure. Some routes require authentication or depend on the availability of the relevant record.

Route	Purpose
/	Home
/heroes	Hero directory
/heroes/:slug	Hero details
/tier-list	Tier-list interface
/tier-list/:shareId	Shared tier list
/counter-pick	Counter-pick research
/matchup	Matchup analysis
/draft	Draft assistant
/draft/:shareId	Shared draft
/build	Build directory
/build/view/:id	Build details
/build/edit/:id	Build editor
/game-data	Game-data directory
/game-data/:kind/:key	Game-data details
/stats	Statistics
/learn	Learning resources
/learn/:slug	Learning resource details
/favorites	User favorites
/matches	Match records
/notifications	Notifications
/feed	Community feed
/profile	User profile
/players/:id	Player profile
/u/:handle	Public user page
/login	Sign in
/register	Registration
/forgot-password	Password recovery
/reset-password	Password reset
/admin	Administration
/privacy	Privacy policy
/terms	Terms of service
/disclaimer	Disclaimer
/data-sources	Data-source information
/community-guidelines	Community guidelines
/contact	Contact

Additional routes, redirects, and error handling may be defined elsewhere in the application.

⸻

Technology Stack

RoV LAB uses the following technologies in its frontend and supporting infrastructure.

Technology	Purpose
React 18	User interface
TypeScript	Static typing
Vite	Development server and build tooling
React Router	Client-side routing
Tailwind CSS	Utility-first styling
Radix UI	Accessible interface primitives
Lucide React	Icons
Supabase	Backend services and database integration
Vercel	Deployment and hosting platform
Vercel Analytics	Usage analytics integration
Vercel Speed Insights	Performance monitoring integration

The exact services and features enabled in a deployed environment depend on the project’s configuration.

⸻

Project Structure

The repository is organized around application pages, reusable components, shared libraries, services, and backend functions.

rovlab/
├── docs/                   # Project documentation
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
├── src/
│   ├── components/         # Reusable UI components
│   ├── lib/                # Shared configuration and utilities
│   ├── pages/              # Application pages
│   ├── services/           # Data access and business logic
│   └── App.tsx             # Application routing and setup
├── supabase/
│   └── functions/          # Supabase Edge Functions
├── package.json
├── README.md
└── vite.config.ts

The actual repository may contain additional directories and files. Consult the source tree for the current implementation.

Architectural Guidelines

* Keep route-level page components in src/pages/.
* Extract reusable interface elements into src/components/.
* Keep shared configuration and reusable utilities in src/lib/.
* Put reusable data access and business logic in suitable services.
* Keep sensitive operations and secrets on the backend.
* Avoid duplicating hero data or other shared game information across unrelated pages.

⸻

Getting Started

Prerequisites

Install the following before developing locally:

* Node.js compatible with the project’s dependencies.
* npm.
* Git.
* A configured Supabase project for features that require backend services.

1. Clone the Repository

git clone https://github.com/bearcarrot/rovlab.git
cd rovlab

2. Install Dependencies

npm install

3. Configure Environment Variables

Create a local .env file in the project root and configure the variables required by the application.

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

Use the correct values for your own Supabase project.

Do not commit private keys, service-role credentials, AI provider keys, or other secrets to source control.

4. Start the Development Server

npm run dev

Vite will display the local development URL in the terminal.

5. Check the Production Build

npm run build

6. Preview the Production Build

npm run preview

Some pages may require valid backend configuration and seeded data to work correctly.

⸻

Environment Variables

Frontend Variables

Variable	Purpose
VITE_SUPABASE_URL	Supabase project URL
VITE_SUPABASE_ANON_KEY	Supabase publishable/anonymous client key, according to the project’s Supabase configuration

Vite exposes variables prefixed with VITE_ to client-side code. Never put server-side secrets in these variables.

Backend Configuration

Supabase Edge Functions and other server-side integrations may require additional environment variables configured in the backend deployment environment.

Examples include AI provider credentials and service-specific configuration. The exact variable names must be taken from the corresponding function implementation and deployment configuration.

Do not assume that setting frontend variables alone configures every backend feature.

⸻

Available Scripts

The following scripts are defined in the project’s package configuration.

Command	Purpose
npm run dev	Start the development server
npm run build	Run the production build and metadata prerendering script
npm run typecheck	Check TypeScript types
npm run lint	Run linting
npm run preview	Preview the production build locally

Run these checks before submitting significant changes.

⸻

Backend and Data

RoV LAB integrates with Supabase for supported backend functionality.

The repository includes Edge Functions associated with features such as:

* AI Coach.
* Avatar handling.
* Hero video functionality.
* Scoreboard OCR.

The responsibilities of each function should be confirmed from its implementation and associated documentation before changing its behavior.

Data Integrity

Game data is central to counter picks, matchups, hero pages, draft analysis, and other features.

When modifying or importing data:

1. Preserve existing identifiers and relationships.
2. Validate required fields and data types.
3. Avoid introducing duplicate records.
4. Check that references point to valid entities.
5. Consider the impact on every feature that consumes the affected data.
6. Document important source and transformation assumptions.

Security

* Enforce authorization on the backend.
* Apply appropriate database access policies.
* Validate untrusted input.
* Avoid exposing private user information.
* Never expose service-role keys or AI provider secrets to the browser.
* Treat OCR output and user-generated content as untrusted input.

⸻

AI Coach

AI Coach is a game-assistance feature, not a source of guaranteed game truth.

When developing or optimizing the Coach AI system, consider:

* Model selection based on task complexity.
* Response quality and consistency.
* Latency and user-perceived responsiveness.
* Provider quotas and request limits.
* Server-side caching for repeatable requests where appropriate.
* Error handling, timeouts, and provider failures.
* Prompt and output validation.
* Fallback behavior when a model is unavailable.
* Monitoring without unnecessarily storing sensitive user information.

Simple predefined questions may be suitable for lightweight models or deterministic responses. Questions requiring detailed reasoning may need a stronger model.

Any model routing or caching strategy should preserve answer quality and must not return stale or inappropriate results when the game data or relevant context has changed.

See the AI Coach documentation in docs/AI_COACH.md for implementation-specific details.

⸻

Development Guidelines

Before Changing a Feature

1. Inspect the relevant page in src/pages/.
2. Trace its imported components, hooks, services, and data sources.
3. Identify all other pages that consume the same data.
4. Review relevant backend functions and database policies.
5. Check loading, empty, error, and permission-denied states.
6. Run the relevant validation scripts.

When Adding a Feature

* Follow existing project conventions.
* Reuse established components and utilities.
* Preserve mobile responsiveness and accessibility.
* Provide meaningful loading and error feedback.
* Handle missing and invalid data safely.
* Avoid unnecessary dependencies.
* Update documentation when behavior, setup, or routes change.

Validation Checklist

Before considering a change complete:

* [ ]	The feature works in its intended route.
* [ ]	Loading, empty, and error states are handled.
* [ ]	Authentication and authorization are respected.
* [ ]	Mobile layouts remain usable.
* [ ]	Shared data consumers have been checked.
* [ ]	Type checking passes.
* [ ]	Linting passes.
* [ ]	The production build succeeds.
* [ ]	Documentation reflects any relevant changes.

⸻

Documentation

Refer to the documentation available in the repository for implementation-specific information.

Document	Subject
docs/ARCHITECTURE.md	Application architecture
docs/AI_COACH.md	AI Coach implementation
docs/DATABASE.md	Database structure and usage
docs/DATA_SOURCES.md	Game-data sources
docs/MATCH_OCR.md	Match screenshot OCR
docs/CONTRIBUTING.md	Contribution guidelines
docs/LEGAL.md	Legal and policy information
docs/community.md	Community-related documentation

If a document has been moved or renamed, use the current repository tree as the source of truth.

⸻

Disclaimer

RoV LAB is an independent community project created to support Arena of Valor players.

It is not an official Garena or Tencent product unless explicitly stated otherwise. Game names, characters, icons, and other related assets may belong to their respective owners.

Game balance, hero abilities, item effects, and competitive strategies may change with updates. Information and recommendations provided by RoV LAB should be checked against the current game version when accuracy is important.

The project is intended to assist players with research and decision-making. It does not guarantee competitive results.

⸻

RoV LAB — Better Tools, Better Wins.
