# Data Assistant

Open `/admin/assistant`, paste the OpenRouter API key into the masked field, and choose **Save Key**. **Refresh Models** retrieves the current OpenRouter catalogue and lists only free variants with zero pricing. Choose a model and press **Test & Activate**. Green requires a valid extraction response; selecting a model or saving a key alone never activates it. Status includes the last successful check and expires after 24 hours. Invalid keys and failed tests show red; free capacity limits show waiting.

Use **Organize existing library** to queue source PDFs. New imports are queued automatically when enabled. The assistant processes five items per request while a Studio or assistant page is open; progress is stored in Postgres and can resume after reloads. Review proposed product names, descriptions, categories, types, series, glass, finishes and millimetre dimensions before applying. Potential duplicate matches are suggestions, never automatic merges. Original PDFs, cropped drawings, prices, quantities, totals and existing documents stay intact. Approved metadata is a separate search overlay. Source changes invalidate that overlay and require fresh analysis. Text-only models preserve pictures but cannot interpret their visual contents.

All inference requests recheck current model eligibility and enforce zero maximum prompt, completion, request and image prices with provider fallback disabled. No paid model arrays, paid OCR, plugins or embeddings are enabled. Rate limits save work for retry; they never switch to a paid model. Only server requests communicate with OpenRouter.

The key is encrypted with AES-256-GCM and never returned by the API. Encryption uses the existing server database credential, or optional `ASSISTANT_ENCRYPTION_KEY`. If that credential is rotated, save the OpenRouter key again (or set a stable separate encryption secret before using stored keys). An existing server `OPENROUTER_API_KEY` remains an optional fallback; Vercel configuration is not required for normal owner key entry. No login was added, as requested.

New tables are idempotent: `assistant_settings`, `assistant_jobs`, `assistant_product_metadata`. Job leases prevent duplicate processing of the same batch. Failed jobs can be re-analyzed; review/apply rejects changed source documents.

Validation covers free-only routing, price changes, malformed replies, invalid keys, encrypted storage, truthful activation, source preservation, duplicate job prevention, similar source detection and multi-batch resume. Existing lint/type/build/PDF checks still apply.
