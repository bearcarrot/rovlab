RoV LAB

Better Tools, Better Wins
เครื่องมือดี มีชัยไปกว่าครึ่ง

RoV LAB is an independent, Thai-first strategy and analytics platform for Arena of Valor (RoV). It brings hero research, tier lists, counter picks, matchup analysis, draft planning, build management, game data, match analytics, and AI-assisted coaching into one web application.

Live Site: https://rovlab.vercel.app

Overview

RoV LAB helps players make more informed decisions before, during, and after a match.

The platform combines structured game data, competitive insights, team-composition analysis, customizable tier lists, build tools, and personal match history. It also provides community features for sharing strategies and reviewing player-created content.

The project prioritizes data consistency, practical mobile usability, transparent recommendations, and a unified experience across its tools.

Features

1. Hero Database

* Browse and search the hero roster.
* View individual hero profiles and available game information.
* Explore available abilities, counters, synergies, and matchup-related information.
* Access hero data used by tier lists, draft recommendations, build tools, and other analysis features.
* Display contextual hero information without presenting empty or invalid records as meaningful data.

Hero information depends on the completeness and freshness of the maintained database.

2. Tier List

Explore hero rankings through the available tier-list views and statistical categories.

* Browse hero rankings and available statistics.
* Filter by supported roles, lanes, tiers, and views.
* View patch context when available.
* Share supported tier-list views.
* Generate shareable tier-list images where supported.
* Use tier indicators and balance-change labels to help interpret hero rankings.

Custom Tier Lists

Create personalized tier lists with user-defined rows.

* Add, rename, recolor, reorder, and delete tier rows.
* Assign heroes from the existing hero database.
* Use the application’s own hero icons rather than uploading arbitrary hero images.
* Preserve hero identity through database identifiers.
* Support legacy saved tier-list formats where compatible.

Custom tier lists are intended for personal rankings and community sharing, not as an official statement of hero strength.

Competitive Statistics

Tier-list views can use available statistical datasets, including supported rank categories such as All Ranks and Commander+.

Statistics and rankings must be interpreted in context. Sample size, patch selection, rank distribution, and source coverage can affect their reliability.

3. Pro Statistics — In Development

PR #237 introduces a planned Pro statistics bucket using competitive statistics published by Liquipedia.

The proposed workflow includes:

* Importing RoV Pro League statistics.
* Storing statistics against the relevant game patch to preserve historical snapshots.
* Using combined Picks & Bans (∑) as a measure of competitive presence.
* Calculating relative tiers against the highest Picks & Bans (∑) value in the selected dataset.

The proposed tier thresholds are:

Tier	Relative Picks & Bans (∑)
S+	≥ 80%
S	≥ 60% and < 80%
A	≥ 40% and < 60%
B	≥ 20% and < 40%
C	< 20%

The relative value is calculated as:

Hero Picks & Bans (∑) / Highest Picks & Bans (∑) × 100

This is a relative competitive-presence indicator, not a win-rate measurement or a guarantee of performance.

Status: The Pro statistics feature is associated with PR #237 and should not be considered production-ready until the pull request is merged, the required data and database changes are applied, and the feature is verified.

Competitive statistics derived from Liquipedia must retain appropriate attribution and comply with the source’s applicable licensing terms, including CC BY-SA where relevant.

4. Counter Pick

Research potential counter picks for a selected hero.

* Browse counter recommendations using available hero data.
* Review matchup-related information and explanations where available.
* Display lane tips only when meaningful lane-tip data exists.
* Navigate directly to results after selecting a hero, improving usability on mobile devices.
* Reuse counter information in supported hero-detail views.

Counter recommendations depend on the available matchup data and should be evaluated alongside team composition, player skill, builds, and game conditions.

5. Matchup Analysis

Compare two heroes and explore their matchup context.

* Select heroes for side-by-side analysis.
* Review available matchup results and supporting context.
* Use shared-lane information for heuristic comparisons.
* Avoid presenting an unrelated primary lane as though both heroes normally meet there.
* Navigate automatically to results after selecting both heroes.
* Pass relevant matchup context to Coach Ai where supported.

Curated matchup information may contain manually maintained guidance, while heuristic results depend on the available data and analysis logic. These result types should not be treated as interchangeable.

6. Draft Assistant

Plan team compositions and evaluate draft choices.

* Explore available hero choices for a team draft.
* Review team composition and role coverage.
* Evaluate team needs such as damage distribution, healing, and shielding when supported by available hero data.
* Use hero skill-kit information to improve team composition analysis.
* Review tier-related indicators and draft balance information.
* Share supported draft scenarios.

Recommendations are intended to support decision-making rather than replace player judgment. They depend on the quality of the underlying hero data and the assumptions used by the analysis.

7. Build Management

Browse, create, and manage supported hero builds.

* Select a hero and explore available build information.
* Manage item, rune, and enchantment selections where supported.
* View build details through supported routes.
* Create and edit builds according to account permissions.
* Share builds through supported application links.
* Use item selection interfaces with search and contextual item information.

The build interface supports game-specific configuration rather than arbitrary image uploads for hero selection.

Build effectiveness depends on the current game version, matchup, team composition, and player preferences.

8. Game Database

RoV LAB maintains structured game information used by its tools.

Supported data categories include:

* Heroes
* Items
* Runes
* Challenger spells
* Enchantments
* Patch and balance information
* Other maintained game-data records

Authorized administrators can manage supported records through the administration interface.

Data-management workflows include validation and verification controls where implemented. Records should be reviewed before being treated as authoritative, and changes to shared data should be checked for downstream effects.

9. Match Analysis and Personal Match History

Review recorded matches and explore performance trends.

Match Screenshot OCR

* Submit supported match screenshots.
* Extract match information and item selections through the OCR workflow.
* Review recognized information before saving it.
* Use supported match records for subsequent analysis.

OCR results can be affected by image dimensions, screenshot layout, scaling, and visual clarity. Extracted values should be checked before being treated as accurate.

Analytics Dashboard

The match analytics interface supports analysis of recorded matches, including:

* Filtering by period and hero where available.
* Reviewing performance trends over time.
* Comparing recent results against a previous period.
* Sorting hero-related statistics.
* Exploring match-level summaries and analytical insights.
* Reviewing insights with sample-size context.
* Accounting for limitations when the loaded match history reaches its configured limit.

Derived metrics may be unavailable or excluded when the underlying records are incomplete or inconsistent. Insights should distinguish observed facts from suggestions.

10. Coach Ai

Coach Ai provides AI-assisted guidance for supported RoV workflows.

* Access supported quick-question experiences.
* Receive contextual guidance for supported hero and matchup scenarios.
* Use available application data as context for AI responses.
* Route supported requests through configured AI models.
* Collect feedback on responses where the relevant functionality and backend configuration are available.
* Support administrative review workflows for submitted feedback where configured.

The model-routing architecture is intended to balance response quality, latency, and resource usage by selecting suitable models for supported request types.

AI-generated responses may be incomplete, outdated, or incorrect. They should be checked against current game mechanics and reliable sources.

11. Community and Sharing

Community features allow users to access and share supported content.

Depending on account status and feature availability, these include:

* User profiles and public player pages.
* Community feed and notifications.
* Shared tier lists and draft scenarios.
* Supported build and strategy links.
* Favorites and personal match records.
* Feedback and moderation workflows.

User-generated content should be handled according to the application’s authorization and community rules.

12. Accounts and Administration

The application includes supported account workflows such as:

* Registration and login.
* Password recovery and reset.
* User profiles.
* Restricted administrative pages.
* Game-data management.
* Supported community moderation and review workflows.

Administrative actions require appropriate authorization. Access to administrative functionality must not rely solely on hiding controls in the client interface.

Application Areas

Area	Purpose
Home	Feature discovery and game overview
Heroes	Hero directory and hero profiles
Tier List	Hero rankings and custom tier lists
Counter Pick	Counter-pick research
Matchup	Hero matchup analysis
Draft	Team composition planning
Builds	Build browsing and management
Game Data	Structured game information
Stats	Available statistical views
Learn	Learning resources
Matches	Match history and analytics
Feed	Community content
Profile / Players	User and player profiles
Favorites	Saved content
Notifications	User notifications
Admin	Restricted administrative tools

Availability may depend on authentication, permissions, database configuration, and the completeness of the relevant data.

User Experience and Accessibility

RoV LAB includes ongoing improvements to usability and accessibility.

* Responsive layouts for supported screen sizes.
* Searchable selection controls for supported hero and item workflows.
* Automatic navigation to relevant results in selected analysis flows.
* Reduced-motion preferences for supported scrolling behavior.
* Accessible control states and labels where implemented.
* Improved handling of empty states, query failures, and invalid shared-link parameters.
* More reliable item recognition across supported screenshot layouts.
* Improved visual contrast for the S+ tier indicator.

The application continues to evolve, and individual interfaces may have different levels of testing and verification.

Security and Reliability

Security and reliability work includes:

* Enforced Content Security Policy (CSP) with a hash-based allowance for the inline boot script.
* Avoiding unsafe-inline and unsafe-eval for scripts in the enforced script policy.
* Database access controls and backend authorization for protected workflows.
* Validation of shared-link parameters and imported data.
* Error handling that distinguishes failed queries from genuinely empty results.
* Defensive handling of malformed or incomplete records.
* Recovery behavior for supported stale-asset loading failures.

Security configuration and database policies should be reviewed whenever deployment behavior, third-party integrations, or application entry points change.

Technology Stack

RoV LAB uses the following technologies:

* React 18
* TypeScript
* Vite
* React Router
* Tailwind CSS
* Radix UI
* Lucide React
* Supabase for supported database and backend functionality
* Supabase Edge Functions for selected server-side workflows
* Vercel for deployment, analytics, and performance insights

Selected server-side workflows include AI coaching, avatar handling, hero video support, and match screenshot OCR.

Data Quality Principles

* Preserve relationships and stable identifiers when updating game data.
* Validate imports and avoid duplicate or malformed records.
* Associate time-sensitive statistics with their relevant patch and source.
* Preserve historical data where required for comparison.
* Avoid presenting missing data as confirmed information.
* Distinguish manually curated guidance from heuristic recommendations.
* Check downstream tools after changes to shared datasets.
* Treat OCR output and user-generated content as untrusted input.
* Keep AI-generated conclusions appropriately qualified.

Data Sources and Attribution

Game balance, hero abilities, item effects, competitive statistics, and strategies can change over time. Information should be interpreted in the context of the relevant game version, patch, and source.

Competitive statistics imported from Liquipedia must retain appropriate attribution and comply with the applicable source licensing terms.

Arena of Valor, game characters, artwork, icons, and related trademarks may belong to their respective owners.

Disclaimer

RoV LAB is an independent community project and is not an official Garena or Tencent product.

The platform provides tools and information to support research, planning, and decision-making. Rankings, matchup recommendations, build suggestions, analytics, and AI-generated responses do not guarantee competitive results.

Always consider the current game version, source quality, team composition, and actual match conditions when applying recommendations.

⸻

RoV LAB — Better Tools, Better Wins.
