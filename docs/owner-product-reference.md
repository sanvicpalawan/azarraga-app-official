# Owner product and drawing workflow

The Design Studio is a reusable library of the shop's actual products. An owner imports a quotation PDF, checks the extracted drawings and item details, saves it, and selects products into a new or existing quote/invoice. Prices, quantities, units, descriptions, dimensions and drawings remain editable on the new document. Reusing a product never changes the source quotation.

## Grounded in the 20 supplied PDFs

The November 5 import contains 189 source rows and 85 original drawing cells. Drawings are raster crops of actual vector PDF artwork, not guessed replacement icons. Some source documents genuinely contain no product drawings; those cells remain blank. The original PDF is retained alongside its file hash and quotation metadata.

Relevant product structures include:

| Product | Details that must travel with its drawing |
|---|---|
| Sliding windows and doors | Series (798/900/130), fixed versus moving panels, arrows, panel count, screen, finish, glass and overall size |
| Casement and ED doors | Swing direction, single/double openings, adjacent fixed glass, transoms and frame profile |
| Awning and fixed combinations | Grid arrangement, fixed versus awning panels, opening marks and size |
| Jalouplus windows | Blade count, number of panels and glass dimensions; do not treat blade supply as a window set |
| Frameless assemblies | Glass thickness/type, multiple grouped opening codes, fittings, partitions and full assembly size |
| Special glass | Irregular canopy outline, fixing holes, transaction notches, skylights and laminated construction |

Descriptions use metres, including precise three-decimal dimensions. Store integer millimetres; do not round 6.604 m to 6.60 m. Commercial assemblies exceed 12 m. Blade sizes can be as small as 0.01 m. Item codes include dotted references, grouped codes and duplicates within the source; source identity is the file plus row, not the printed code alone.

## Price policy

Historical prices are evidence of what was quoted on a date, not current rates or a pricing formula. Owners can edit the suggested price in a new document. Keep the historical price and source date separately. New quantities start at one. Preserve pc/pcs, LS and set units. Keep delivery, crating, shipping and installation as separate charges; do not silently spread them into product rates or copy them onto a new project.

## Review and version policy

- Preserve all four Turnkey Q2026-900 variants and all three MVP Q2026-530 variants independently.
- AbinApurawan shares Q2026-660 with an older imported document and has an added delivery charge. The older document remains unchanged.
- PayapaJalousy prints PHP33,840; its listed items plus delivery add to PHP36,720. The owner explicitly requested keeping it flagged for review. No amount was corrected or excluded.
- Imported quotations do not establish payment, acceptance or completed installation.
- Re-importing an identical PDF is detected by file hash. A different file using the same quotation number is a separate source variant.

## Drawing editing boundary

The original crop can be reused immediately in a quote/invoice. It is not automatically an editable vector model. Studio shows it beside a blank canvas at the source size so the owner can construct an editable design with panel templates and drawing tools. Applying a new design saves its model, PNG and SVG on the document line while retaining source provenance. Changing the dimensions of an attached drawing requires updating that drawing; items with no drawing can change size directly.

## Deployment state

The 20 source records were saved and read back from the existing live Postgres-backed project archive. The Studio library/importer and editable document integration are local preview code until reviewed and deployed. Customer PDFs are stored as app data, not committed to Git.
