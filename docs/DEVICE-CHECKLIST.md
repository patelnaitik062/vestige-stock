# Android build and device verification — pending

These checks were not executed in the creation environment. Use a test product
and sample transactions, then restore your intended empty-store backup before
recording live stock. Keep test and real data separate.

1. Build `:app:assembleDebug :app:lintDebug` and resolve any Android compilation
   or lint errors before installation. The source has only been syntax-parsed.
2. Install on an Android 8+ device with an updated Android System WebView.
   Confirm startup in airplane mode and that data survives force-stop/reopen.
3. At narrow widths and with large system text, check all bottom-navigation
   items, forms, sheets, keyboard insets and Android Back behavior. Nothing
   should be cut off or hidden behind the system bars/keyboard.
4. Register a scanned test barcode with DP 100, GST 18%, MRP 160. Verify the live
   selling-price preview shows 129.80. Try both pricing modes, then restore the
   default. Confirm missing GST cannot be silently treated as a selected rate.
5. Check camera permission denial/retry, scan cancellation, EAN-13 and QR batch
   labels, leading-zero codes, and the connected hardware scanner's Enter suffix.
6. Receive a ten-unit batch. Confirm stock/purchase totals once. Try cancelling
   another draft; stock must not change. Repeat with an opening balance.
7. Scan the test product twice to bill two units. Verify 259.60 total and eight
   units remaining only after completion. Reopen the app and inspect the bill.
8. Export the bill PDF through the Android file picker. Open the actual saved
   file and check currency text, item names, MRP, selling price, quantity, totals,
   store details, customer and payment method. Test a long multipage bill.
9. Cancel an export and retry from Activity. Confirm the sale/stock are unchanged.
   Repeat quick export taps; only one destination dialog should be active.
10. Save a batch-label PDF, print it, and scan it with the device camera. Receive
    a second batch of the same product; the retail barcode must request a batch
    scan. Ensure actual physical batch, printed MRP and inventory allocation agree.
11. Change product DP to 110. Confirm new price 142.78 while the old invoice
    remains 129.80 per unit. Draft prices require refresh before checkout.
12. Test insufficient stock, expired stock, inactive products and prices above
    MRP. Checkout must refuse without partially saving a sale.
13. Return one unit from the original invoice after changing DP. Verify refund
    129.80. A second return beyond the original quantity must be rejected.
    Unsaleable/expired returns must go to quarantine.
14. Export backup, keep it safe, and restore after inspecting the preview. Verify
    products, batch balances, old invoices, their PDF contents and saved drafts.
15. Before keeping live stock, configure the actual store details and pricing,
    check your business's receipt requirements, and retain a reliable backup.
