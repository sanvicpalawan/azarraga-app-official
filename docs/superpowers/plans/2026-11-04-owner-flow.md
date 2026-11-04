# Owner quotation flow implementation plan

Spec: user Phase 2 and AUDIT.md, amended by the owner's later instruction to remove all password/login protection.

- [x] Audit completed before Phase 2; existing normalized storage retained with compatibility names.
- [x] Size entry in m/mm/fractional ft-in; canonical mm, live sqft and preserved per-area pricing/options.
- [x] Idempotent normalized schema initialization and additive design metadata; legacy quotations preserved.
- [x] Reusable customers with list/editor/picker and development memory persistence.
- [x] Save/review/PDF, reopen/edit, validated status transitions and duplicate navigation.
- [x] Staff catalog routes into one builder; administration separated; image/logo storage unchanged.
- [x] Password/login work canceled and removed per the owner's explicit instruction.
- [ ] Final checks, feature-branch commit/push and PR; no merge or production release.

Rulings: existing normalized tables are authoritative, with customers/quotes/quote_items compatibility views. A third independent quote store would fragment live data. No pricing hierarchy is fabricated without real source documents. The local preview remains available while branch changes are reviewed.
