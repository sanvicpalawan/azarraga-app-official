# Real quotation history and image reuse

The owner supplied 20 original PDFs and authorized importing them into the live application. Keep each original PDF, quotation number, file variant, item code, description, size, quantity, unit, price and actual drawing. The source PDFs are quotations, not evidence of payment or completed work. Preserve the Payapa arithmetic mismatch for owner review, as explicitly requested.

## Implementation

- [x] Extract all pages using PDF table geometry; crop actual vector drawing cells to PNG. Do not generate replacement drawings for absent originals.
- [x] Reconcile row prices, printed subtotals and separately labelled charges. Identify repeated quotation numbers without merging variants.
- [x] Save 20 historical records in the existing Postgres-backed project archive, retaining original PDFs and SHA256 provenance. No schema change or new storage provider.
- [x] Verify every persisted PDF hash, row, amount and drawing against the local prepared record.
- [x] Fix the existing Past Projects → quote handoff, which currently passes only a description and loses the source image, dimensions and rate. Pass a stable project/item reference, resolve on the server, and retain provenance on the line snapshot. Historical prices require review; new quantity defaults to one.
- [x] Show original PDF drawing alongside the Studio when editing an imported image. A raster reference must not be presented as an already editable vector reconstruction.
- [x] Test size/image/provenance preservation, missing drawings, disputed records and grouped codes. Run lint, typecheck and build; keep new code in preview pending the owner's review.

## Validation facts

20 PDFs, 189 item rows, 85 actual drawing cells. Nineteen files reconcile. Payapa prints PHP33,840 but its rows plus delivery sum to PHP36,720. MVP has three distinct Q2026-530 variants; Turnkey has four Q2026-900 variants. AbinApurawan shares Q2026-660 with an existing historical document, and adds a delivery charge; do not overwrite that existing record.
