# RoV LAB — AI Coach

> Last reviewed: 2026-10-02

## Purpose

AI Coach provides contextual gameplay analysis based on data available to RoV LAB.

It is an analytical assistant, not an official RoV game service or authoritative source of game information.

## Current Integrations

The project documentation has reported AI Coach integration with:

- Hero Detail
- Counter Pick
- Matchup
- Draft Assistant
- Item Build

Home insights are intentionally separate while the Home insight dataset remains mock/placeholder data.

Operational details should be verified against the deployed Edge Function before being treated as current.

## Context Supplied to the Model

Depending on the feature, AI Coach may receive assembled information such as:

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

AI Coach should:

1. Separate supplied facts from analysis.
2. Avoid inventing unavailable statistics.
3. Avoid claiming that AI analysis is official.
4. Mention uncertainty when the underlying data is incomplete.
5. Prefer patch-aware information.
6. Make recommendations conditional on the match context.
7. Avoid presenting heuristics as guaranteed outcomes.

## Updating AI Coach

When changing AI Coach:

- update the Edge Function
- review prompt/context assembly
- verify secret handling
- test failure states
- update this document
- update the roadmap if the feature behavior changes
