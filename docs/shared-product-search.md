# Shared product search

Every owner screen has the same product search and All / Windows / Doors / Others controls. It searches source quotations and the catalog by product details, series, glass, finish, dimensions, account, quotation number and source filename.

The owner can choose 50, 100, 250 or All products in the shared search, product libraries and drawing references. The choice is remembered on that device and shared across screens. All removes page navigation and displays every matching product. Requests are debounced and superseded requests are cancelled. The production search filters and counts inside Postgres before selecting the requested number of results; original PDFs and off-page drawing images are not returned. Development uses the same filtering semantics against temporary local memory.

While editing a quote or invoice, selecting a search result adds it to the active item section without navigation or discarding unsaved work. Its original drawing is snapshotted onto the line. Original source records remain unchanged, historical prices remain editable, and a price in another currency is cleared rather than relabelled.

Studio import deduplication uses lightweight file fingerprints and counts instead of loading all old PDFs and images. Different source files using the same quotation number remain separate versions. Imports still require a review of extracted rows and arithmetic before saving; Payapa's disputed total remains flagged.

The original PDF drawings are reusable images. Editable panel models are a separate capability: the source image is available beside Studio's drawing tools, and owner-created models retain their editable JSON and SVG on document lines. Automatic reconstruction of arbitrary imported pictures into editable panel geometry is not implemented.

No new environment variables, storage services or authentication are required. Production continues to use the existing DATABASE_URL. Local memory is temporary and should not be enabled on Vercel.
