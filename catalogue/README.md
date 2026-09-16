# Official Vestige India catalogue snapshot

Collected 16 September 2026 from the public India store, starting at
https://www.myvestige.com/sitemap. The JSON includes source URLs for every product
and every category, counts, collection date, exclusions and price notes.

- 255 listings were read from 12 official category pages. Card counts matched
  the displayed category totals.
- 253 positive-MRP listings with published pack sizes are included.
- MCI150 and MCI300 are excluded: blank pack size and zero placeholder MRP.
- Only product facts are copied: name, pack, category, website reference and MRP.
  Promotional descriptions, health claims and images are not copied.
- The final segment of the official product URL is used as a website reference.
  It is NOT represented as a verified retail barcode.
- MRP is tax-inclusive, stored as integer paise. Printed batch MRP takes priority.
- DP before GST, GST rate and manufacturer barcodes are unavailable from these
  public cards. They remain unset. There is no calculated selling price until
  confirmed by the owner from their invoice and physical pack.
- No availability or live online stock is imported. All catalogue entries start
  at zero local stock. Existing store records are never reset or matched by name.

The app bundles the same data in `app/src/main/assets/catalogue.js`. Setup QR
payloads use `VSCAT:<website-reference>`. These populate a registration form only
after the physical barcode has been scanned. The user checks the product/pack
and enters DP/GST before saving. The business core rejects incomplete prices,
duplicate catalogue links and setup QR codes used as physical barcodes.

An existing product can acquire a catalogue reference without changing its
price, name, barcode, stock or completed transaction history. The bundled reference
list is separate from transactional inventory; JSON backups include confirmed
product links, and old version-1 backups remain readable.
