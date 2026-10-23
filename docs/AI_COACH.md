# RoV LAB — Coach Ai

> Last reviewed: 2026-10-02

## Purpose

Coach Ai provides contextual gameplay analysis based on data available to RoV LAB.

It is an analytical assistant, not an official RoV game service or authoritative source of game information.

## Current Integrations

The project documentation has reported Coach Ai integration with:

- Hero Detail
- Counter Pick
- Matchup
- Draft Assistant
- Item Build

Home insights are intentionally separate while the Home insight dataset remains mock/placeholder data.

Operational details should be verified against the deployed Edge Function before being treated as current.

## Context Supplied to the Model

Depending on the feature, Coach Ai may receive assembled information such as:

- hero information
- hero statistics
- counters
- synergies
- matchup information
- items
- item builds
- draft context
- heuristic labels
- user-selected context

The model should reason from supplied context instead of inventing unavailable statistics.

## AI Limitations

AI output can:

- contain factual errors
- misinterpret game mechanics
- overgeneralize from limited data
- inherit errors from source datasets
- become outdated after game patches
- provide recommendations that are not optimal in a particular match

AI output should therefore be treated as assistance rather than a guarantee.

## API Key Security

Private AI provider credentials must remain server-side.

The Gemini API key must not be exposed through frontend variables such as:

```text
VITE_GEMINI_API_KEY
```

The intended architecture is to keep provider credentials in Supabase Edge Function secrets and call the model from the server-side function.

## Edge Function

The project has used an Edge Function named:

```text
ai-coach
```

The exact deployed implementation, model configuration, retry behavior, and fallback behavior should be verified before documenting them as guaranteed production behavior.

## Avatar Processing

The project has also used an `avatar` Edge Function for AI-assisted profile image inspection.

Uploaded images should be validated for:

- file type
- file size
- processing result

The system should fail safely when validation or AI processing fails.

## AI Output Policy

Coach Ai should:

1. Separate supplied facts from analysis.
2. Avoid inventing unavailable statistics.
3. Avoid claiming that AI analysis is official.
4. Mention uncertainty when the underlying data is incomplete.
5. Prefer patch-aware information.
6. Make recommendations conditional on the match context.
7. Avoid presenting heuristics as guaranteed outcomes.

## Answer Feedback (Like / Dislike)

Every Coach Ai answer (floating chat and inline ask buttons) has a "คำตอบนี้ถูกต้องไหม?" row.

- **Like** is saved immediately.
- **Dislike** opens a required "ผิดตรงไหน?" field (3 to 500 characters), then saves a report.
- Reports store the question, the answer, the page path and, for dislikes only, the exact data given to the AI
  (same 8000-character cut as the Edge Function). This lets an admin tell "the AI made it up" apart from "our data is wrong".
- Storage is the `coach_feedback` table (migration `20261010_coach_feedback.sql`). Clients never touch the table:
  they call `submit_coach_feedback` (own rows, validated, 30 per user per 24h). Only admins read and triage, via
  `admin_list_coach_feedback`, `admin_update_coach_feedback` and `admin_coach_feedback_counts` (all check `is_admin()`).
- Admins review in `/admin` under the "รีวิว Coach Ai" tab and set a status: new, reviewed, fixed or dismissed, with a note.

## Hero Detail build context

On Hero Detail the quick chats "ทำไมบิลด์นี้เหมาะ" and "ปรับไอเทมตามศัตรู" send the build currently selected in the
"บิลด์แนะนำ" card (`features/heroes/buildCoachContext.ts`). It is loaded once by `useHeroBuilds`, so the card and Coach Ai
always use the same build.

- `build` carries: `buildId`, `kind` (curated/heuristic), `patch`, `latestPatch`, `patchIsLatest` (false = older than the
  current patch; null = latest patch unknown), `createdAt`, ordered `items` (`id` = `items.slug`, Thai name, phase, cost,
  a few stats, trimmed passive/reason), `runes`, `challengerSpell`, `enchantments`. Items missing from the `items` table
  are skipped, never invented. Text is trimmed step by step to stay under the 8000-char cut; the item/rune lists are never cut.
- No build for the hero: context has `build: { available: false }` so the model must say so instead of inventing one.
  While builds are loading or failed, the two build chats are not registered (the other quick chats work as before).
- `ai-coach` rules 6-10 separate "ข้อมูลในระบบ" (database facts) from "คำแนะนำจาก AI", forbid calling an old-patch build
  the latest meta, and limit item swaps to `build.items` (anything else only as a category, e.g. magic resist).
- When the context has `build.items`, `ai-coach` also checks the answer for item names that are not in the context
  (retry once, then error), same idea as the hero-name check. Item names shorter than 6 Thai / 5 Latin characters are
  skipped (too ambiguous). This check does nothing for requests without a build, so other pages are unaffected.

## DB-first answers (no Gemini)

Some Quick Chats are answered straight from RoV LAB data, without calling `ai-coach`, so they cost no Gemini quota.
`src/features/coach/directAnswers.ts` builds the text; a page attaches it as `QuickChat.direct`. When `direct` is set,
`CoachFab` shows it immediately (labelled "ตอบจากข้อมูลในระบบ RoV LAB"); when it is `undefined` the question goes to `ai-coach` as before.

| Quick Chat (id) | Answered from the DB when | Otherwise |
| --- | --- | --- |
| `skills` | every ability has a description | Gemini |
| `pros-cons` | the hero has both strengths and weaknesses | Gemini |
| `how-to-face` | at least one counter has a reason or lane tip | Gemini |
| `matchup-plan` | curated plan written for the user's side (not reversed, not stats-only) | Gemini |
| `build-why` | curated build with at least one written reason | Gemini |

Always Gemini: `how-to-play`, `who-fits`, `game-phase`, `build-situational`, `draft-eval`, `pick-*` (they need analysis).

Rules for `directAnswers.ts`: every line comes from a DB field (no analysis, nothing invented); "not sure / data incomplete"
returns `undefined` so Gemini answers; scoreboard image reading (`scoreboard-ocr`) is a separate function and is not affected.
Like/Dislike still works on these answers.

## Updating Coach Ai

When changing Coach Ai:

- update the Edge Function
- review prompt/context assembly
- verify secret handling
- test failure states
- update this document
- update the roadmap if the feature behavior changes
