# Free-only data assistant implementation

Approved scope: existing Next.js app; OpenRouter free models only; admin selection, fresh catalogue, tested activation indicator; durable source-document organization with owner review. No login, paid fallback, price changes or reconstruction claims.

1. Add a strict OpenRouter client and regression tests for zero pricing, model removal, activation validation and rate limits. Use zero-price provider caps, no paid tools/fallbacks, server-only credentials.
2. Add idempotent assistant settings, resumable jobs and separate product metadata. Keep original files/drawings/prices unchanged. Validate every proposed item against its source and detect similar products deterministically.
3. Add admin controls and Studio queue/review cards. Queue new imports automatically; process bounded batches while the workspace is open. Save progress across refreshes; apply organization explicitly and safely.
4. Include approved metadata in product search. Test source preservation, retries, duplicate job prevention and stale-source rejection.
5. Run tests, lint, type checks, production build and PDF trace check. Commit/push main, deploy the exact commit, verify responsive controls and actual provider status. Never show green without a successful live extraction check.
