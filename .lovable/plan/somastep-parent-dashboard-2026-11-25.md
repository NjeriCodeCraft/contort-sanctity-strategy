# SomaStep parent dashboard

## Goal
Replace the placeholder home page with a responsive parent dashboard for SomaStep, using the supplied REST API as the only data source.

## Build
- Add a browser-side API helper with the supplied API base URL, required ngrok header, bearer-token handling, friendly errors, and the eight-character new-code rule.
- Implement login, required code change, authenticated dashboard, loading/error/empty states, and 401 sign-out behavior on `/`.
- Create the warm, professional desktop-first layout with child details, learning timeline, AI progress placeholder, and mobile/tablet adaptations.
- Add route-specific metadata and semantic design tokens; keep all data requests on the supplied API without adding a database.
- Add focused tests for required request headers and the new-code length rule, and document the API-helper architecture.

## Validation
Run the focused tests, inspect preview build/runtime logs, and verify the rendered page and responsive layout. Authenticated API responses cannot be verified without working parent credentials.