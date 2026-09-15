(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StockCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_MONEY = 10000000000;
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = message => { throw new Error(message); };
  const assert = (ok, message) => { if (!ok) fail(message); };
  const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const integer = (n, label, max = MAX_MONEY) => { assert(Number.isSafeInteger(n) && n >= 0 && n <= max, `Invalid ${label}.`); return n; };
  const text = (s, max = 120) => String(s ?? '').trim().slice(0, max);
  const quoteEqual = (expected, actual) => actual && Object.keys(expected).every(key => expected[key] === actual[key]);
  const roundRatio = (n, numerator, denominator) => {
    integer(n, 'amount'); integer(numerator, 'multiplier', 1000000); integer(denominator, 'divisor', 1000000);
    assert(denominator > 0, 'Invalid divisor.');
    const total = BigInt(n) * BigInt(numerator), d = BigInt(denominator);
    const answer = Number((total + d / 2n) / d);
    return integer(answer, 'calculated amount');
  };
  function cents(value) {
    const s = String(value).trim();
    assert(/^\d+(\.\d{1,2})?$/.test(s), 'Enter a non-negative amount with up to two decimal places.');
    const [a, b = ''] = s.split('.');
    return integer(Number(a) * 100 + Number(b.padEnd(2, '0')), 'amount');
  }
  function rate(value) { const n = cents(value); return integer(n, 'GST percentage', 10000); }
  function money(n) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n / 100); }
  function day(now = Date.now()) {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00');
    return !isNaN(d.getTime()) && day(d) === value;
  }
  function quote(p, settings) {
    integer(p.dp, 'DP'); integer(p.mrp, 'MRP'); integer(p.gstBps, 'GST percentage', 10000);
    const costInclusive = roundRatio(p.dp, 10000 + p.gstBps, 10000);
    const selling = settings.pricingMode === 'margin'
      ? roundRatio(costInclusive, 10000, 9000)
      : roundRatio(costInclusive, 11000, 10000);
    const net = roundRatio(selling, 10000, 10000 + p.gstBps);
    return { dp: p.dp, mrp: p.mrp, gstBps: p.gstBps, gstOnDp: costInclusive - p.dp,
      costInclusive, selling, net, tax: selling - net, profit: net - p.dp,
      overMrp: selling > p.mrp, pricingMode: settings.pricingMode };
  }
  function fresh() {
    return { schema: 1, revision: 0, settings: { storeName: 'My Vestige Store', address: '', phone: '', gstin: '', pricingMode: 'markup' },
      products: [], lots: [], purchases: [], sales: [], returns: [], movements: [], audit: [],
      saleDraft: { id: id(), lines: [], customer: '', payment: 'Cash' },
      purchaseDraft: { id: id(), lines: [], supplier: '', reference: '', opening: false } };
  }
  function resolve(s, raw) {
    const code = String(raw).replace(/[\r\n]+$/, '');
    assert(code.length > 0 && code.length <= 160 && !/[\x00-\x1f]/.test(code), 'Invalid barcode. Please scan again.');
    const lot = s.lots.find(l => l.code === code);
    const product = s.products.find(p => p.barcode === code || (lot && p.id === lot.productId));
    return { code, product, lot };
  }
  function available(lot, now = Date.now()) { return lot.qty > 0 && (!lot.expiry || lot.expiry >= day(now)); }
  function chooseLot(s, code, now = Date.now()) {
    const r = resolve(s, code);
    assert(r.product, 'Barcode not registered. Register the product first.');
    assert(r.product.active, 'This product is inactive.');
    const lots = s.lots.filter(l => l.productId === r.product.id && available(l, now));
    if (r.lot) {
      assert(available(r.lot, now), 'This batch is expired or out of stock.');
      return { product: r.product, lot: r.lot };
    }
    assert(lots.length, 'No saleable stock. Receive a purchase first.');
    assert(lots.length === 1, 'Multiple batches available. Scan the internal batch label for the stock being sold.');
    return { product: r.product, lot: lots[0] };
  }
  function stock(s, productId, now = Date.now()) { return s.lots.filter(l => l.productId === productId && available(l, now)).reduce((n, l) => n + l.qty, 0); }
  function sellingQuote(s, lot) {
    const p = s.products.find(p => p.id === lot.productId);
    const q = quote({ dp: p.dp, gstBps: p.gstBps, mrp: lot.mrp }, s.settings);
    return { ...q, costDp: lot.dp, profit: q.net - lot.dp };
  }
  function adjustmentLot(s, code) {
    const r = resolve(s, code);
    assert(r.product, 'Product not registered.');
    const lots = r.lot ? [r.lot] : s.lots.filter(l => l.productId === r.product.id && l.qty > 0);
    assert(lots.length === 1, 'Scan the internal batch barcode to select stock for adjustment.');
    assert(lots[0].qty > 0, 'This batch has no remaining stock.');
    return { product: r.product, lot: lots[0] };
  }
  function productInput(p) {
    const barcode = String(p.barcode || '');
    assert(barcode.length && barcode.length <= 160 && !/[\x00-\x1f]/.test(barcode), 'Scan a valid barcode.');
    assert(text(p.name).length, 'Product name is required.');
    assert(p.dp > 0 && p.mrp > 0, 'DP and MRP must be greater than zero.');
    integer(p.dp, 'DP'); integer(p.mrp, 'MRP'); integer(p.gstBps, 'GST percentage', 10000);
    integer(p.reorder ?? 5, 'reorder level', 1000000);
    return { barcode, name: text(p.name), pack: text(p.pack, 60), category: text(p.category, 60), dp: p.dp,
      mrp: p.mrp, gstBps: p.gstBps, reorder: p.reorder ?? 5, expiryRequired: !!p.expiryRequired, active: p.active !== false };
  }
  function total(s) {
    return s.saleDraft.lines.reduce((n, l) => n + l.quote.selling * l.qty, 0);
  }
  function apply(original, command, now = Date.now()) {
    const s = clone(original), c = command;
    const audit = (type, target, details) => s.audit.push({ id: id(), time: now, type, target, details });
    const movement = (lot, qty, type, reference, reason = '') => s.movements.push({ id: id(), time: now, lotId: lot.id, productId: lot.productId, qty, type, reference, reason });
    switch (c.type) {
      case 'SAVE_PRODUCT': {
        const input = productInput(c.product);
        const current = s.products.find(p => p.id === c.product.id);
        assert(!s.products.some(p => p.barcode === input.barcode && p.id !== current?.id) && !s.lots.some(l => l.code === input.barcode), 'This barcode is already registered.');
        if (current) {
          assert(current.barcode === input.barcode, 'The registered barcode cannot be changed.');
          const before = clone(current); Object.assign(current, input, { updated: now });
          audit('PRODUCT_UPDATED', current.id, { before, after: clone(current) });
        } else {
          const product = { ...input, id: id(), updated: now };
          s.products.push(product); audit('PRODUCT_REGISTERED', product.id, input);
        }
        break;
      }
      case 'SAVE_SETTINGS': {
        assert(['markup', 'margin'].includes(c.settings.pricingMode), 'Invalid pricing method.');
        const before = clone(s.settings);
        s.settings = { storeName: text(c.settings.storeName) || 'My Vestige Store', address: text(c.settings.address, 360),
          phone: text(c.settings.phone, 40), gstin: text(c.settings.gstin, 30), pricingMode: c.settings.pricingMode };
        audit('SETTINGS_CHANGED', 'store', { before, after: clone(s.settings) }); break;
      }
      case 'PURCHASE_META': Object.assign(s.purchaseDraft, { supplier: text(c.supplier), reference: text(c.reference, 80), opening: !!c.opening }); break;
      case 'PURCHASE_LINE': {
        const p = s.products.find(p => p.id === c.line.productId);
        assert(p?.active, 'Scan an active registered product.');
        const l = c.line; integer(l.qty, 'quantity', 1000000); assert(l.qty > 0, 'Quantity must be at least one.');
        assert(l.dp > 0 && l.mrp > 0, 'DP and MRP must be greater than zero.');
        integer(l.dp, 'DP'); integer(l.mrp, 'MRP'); integer(l.gstBps, 'GST rate', 10000);
        assert(!l.expiry || validDate(l.expiry), 'Enter a valid expiry date.');
        assert(!p.expiryRequired || l.expiry, 'This product requires an expiry date.');
        assert(!l.expiry || l.expiry >= day(now), 'Expired stock cannot be received as saleable stock.');
        s.purchaseDraft.lines.push({ id: id(), productId: p.id, name: p.name, barcode: p.barcode, pack: p.pack,
          qty: l.qty, dp: l.dp, mrp: l.mrp, gstBps: l.gstBps, batch: text(l.batch, 80) || 'Unspecified', expiry: l.expiry || '' }); break;
      }
      case 'REMOVE_PURCHASE_LINE': s.purchaseDraft.lines = s.purchaseDraft.lines.filter(l => l.id !== c.id); break;
      case 'CLEAR_PURCHASE': s.purchaseDraft = fresh().purchaseDraft; break;
      case 'POST_PURCHASE': {
        if (s.purchases.some(p => p.requestId === c.requestId)) return original;
        const d = s.purchaseDraft;
        assert(d.id === c.requestId && d.lines.length, 'No purchase items to receive.');
        assert(!d.reference || !s.purchases.some(p => p.supplier === d.supplier && p.reference === d.reference), 'This supplier invoice reference has already been received.');
        const purchaseId = id(), lines = [];
        d.lines.forEach(l => {
          const product = s.products.find(p => p.id === l.productId);
          assert(product?.active, 'A product is inactive. Remove it from this receipt.');
          assert(!l.expiry || l.expiry >= day(now), 'A receipt batch has expired.');
          const lotId = id();
          const lot = { id: lotId, code: `VSLOT-${lotId}`, productId: l.productId, batch: l.batch, expiry: l.expiry,
            dp: l.dp, mrp: l.mrp, gstBps: l.gstBps, qty: l.qty, received: l.qty, quarantine: 0, created: now, purchaseId };
          s.lots.push(lot); lines.push({ ...l, lotId, lotCode: lot.code, costInclusive: quote(l, s.settings).costInclusive });
          movement(lot, l.qty, d.opening ? 'OPENING' : 'PURCHASE', purchaseId);
        });
        const amount = lines.reduce((n, l) => n + l.costInclusive * l.qty, 0); integer(amount, 'receipt total');
        s.purchases.push({ id: purchaseId, requestId: d.id, number: `PUR-${String(s.purchases.length + 1).padStart(5, '0')}`,
          time: now, supplier: d.supplier, reference: d.reference, opening: d.opening, lines, total: amount });
        audit('PURCHASE_POSTED', purchaseId, { amount }); s.purchaseDraft = fresh().purchaseDraft; break;
      }
      case 'SCAN_SALE': {
        const { product, lot } = chooseLot(s, c.code, now), q = sellingQuote(s, lot);
        assert(!q.overMrp, 'Calculated selling price exceeds this batch MRP. Correct its prices before billing.');
        const current = s.saleDraft.lines.find(l => l.lotId === lot.id);
        assert((current?.qty || 0) + 1 <= lot.qty, 'Not enough stock in this batch.');
        if (current) current.qty++;
        else s.saleDraft.lines.push({ id: id(), lotId: lot.id, productId: product.id, name: product.name, pack: product.pack,
          barcode: product.barcode, batch: lot.batch, qty: 1, quote: q });
        break;
      }
      case 'SET_SALE_QTY': {
        const line = s.saleDraft.lines.find(l => l.id === c.id); assert(line, 'Bill item not found.');
        integer(c.qty, 'quantity', 1000000);
        if (!c.qty) s.saleDraft.lines = s.saleDraft.lines.filter(l => l.id !== c.id);
        else { const lot = s.lots.find(l => l.id === line.lotId); assert(c.qty <= lot.qty, 'Not enough stock.'); line.qty = c.qty; }
        break;
      }
      case 'SALE_META': s.saleDraft.customer = text(c.customer); s.saleDraft.payment = ['Cash', 'UPI', 'Card'].includes(c.payment) ? c.payment : 'Cash'; break;
      case 'CLEAR_SALE': s.saleDraft = fresh().saleDraft; break;
      case 'REFRESH_PRICES': s.saleDraft.lines.forEach(l => { l.quote = sellingQuote(s, s.lots.find(b => b.id === l.lotId)); }); break;
      case 'COMPLETE_SALE': {
        if (s.sales.some(p => p.requestId === c.requestId)) return original;
        const d = s.saleDraft; assert(d.id === c.requestId && d.lines.length, 'Scan products to start a bill.');
        const saleId = id(); let amount = 0, cost = 0, net = 0, tax = 0;
        d.lines.forEach(l => {
          const lot = s.lots.find(b => b.id === l.lotId), p = s.products.find(p => p.id === l.productId);
          assert(p?.active && lot && available(lot, now) && lot.qty >= l.qty, `Stock unavailable or expired: ${l.name}.`);
          const q = sellingQuote(s, lot);
          assert(!q.overMrp, `Selling price exceeds MRP: ${l.name}.`);
          assert(quoteEqual(q, l.quote), 'Prices changed. Refresh bill prices and review the total.');
          amount += q.selling * l.qty; cost += q.costDp * l.qty; net += q.net * l.qty; tax += q.tax * l.qty;
          lot.qty -= l.qty; movement(lot, -l.qty, 'SALE', saleId);
        });
        integer(amount, 'bill total');
        s.sales.push({ id: saleId, requestId: d.id, number: `VS-${String(s.sales.length + 1).padStart(6, '0')}`,
          time: now, customer: d.customer, payment: d.payment, lines: clone(d.lines), store: clone(s.settings), total: amount, cost, net, tax, profit: net - cost });
        audit('SALE_COMPLETED', saleId, { total: amount }); s.saleDraft = fresh().saleDraft; break;
      }
      case 'EDIT_LOT': {
        const lot = s.lots.find(l => l.id === c.id); assert(lot, 'Batch not found.');
        integer(c.dp, 'DP'); integer(c.mrp, 'MRP'); integer(c.gstBps, 'GST rate', 10000);
        assert(c.dp === lot.dp, 'Received purchase cost is historical and cannot be edited.');
        assert(c.gstBps === lot.gstBps, 'Received GST rate is historical and cannot be edited.');
        assert(c.mrp > 0, 'MRP must be positive.');
        const before = lot.mrp; lot.mrp = c.mrp; audit('BATCH_MRP_CORRECTED', lot.id, { before, after: lot.mrp }); break;
      }
      case 'RETURN': {
        const sale = s.sales.find(x => x.id === c.saleId); assert(sale, 'Original bill not found.');
        const { product, lot } = resolve(s, c.code); assert(product, 'Scan the returned product.');
        const candidates = sale.lines.filter(l => l.productId === product.id && (!lot || lot.id === l.lotId));
        assert(candidates.length === 1, 'Scan the original batch barcode to identify the returned line.');
        const line = candidates[0], batch = s.lots.find(l => l.id === line.lotId);
        const prior = s.returns.filter(r => r.saleId === sale.id && r.lineId === line.id).reduce((n, r) => n + r.qty, 0);
        integer(c.qty, 'return quantity', 1000000); assert(c.qty > 0 && c.qty <= line.qty - prior, 'Return exceeds the remaining sold quantity.');
        assert(text(c.reason).length, 'A return reason is required.');
        const restock = c.restock && (!batch.expiry || batch.expiry >= day(now));
        if (restock) batch.qty += c.qty; else batch.quarantine += c.qty;
        const rid = id();
        s.returns.push({ id: rid, saleId: sale.id, lineId: line.id, lotId: batch.id, time: now, qty: c.qty,
          restock: !!restock, reason: text(c.reason), refund: line.quote.selling * c.qty,
          net: line.quote.net * c.qty, cost: line.quote.costDp * c.qty, profit: line.quote.profit * c.qty });
        movement(batch, c.qty, restock ? 'RETURN' : 'QUARANTINE_RETURN', rid, text(c.reason)); audit('CUSTOMER_RETURN', rid, { restock: !!restock }); break;
      }
      case 'ADJUST': {
        const { lot } = adjustmentLot(s, c.code);
        integer(c.qty, 'write-off quantity', 1000000); assert(c.qty > 0 && c.qty <= lot.qty, 'Invalid write-off quantity.');
        assert(text(c.reason).length, 'Enter an adjustment reason.');
        lot.qty -= c.qty; lot.quarantine += c.qty; movement(lot, -c.qty, 'WRITE_OFF', id(), text(c.reason)); audit('STOCK_ADJUSTED', lot.id, { qty: -c.qty, reason: text(c.reason) }); break;
      }
      default: fail('Unknown action.');
    }
    s.revision++; return s;
  }
  function metrics(s, since = 0, now = Date.now()) {
    const sales = s.sales.filter(x => x.time >= since && x.time <= now), returns = s.returns.filter(x => x.time >= since && x.time <= now);
    const sum = (list, key) => list.reduce((n, x) => n + x[key], 0);
    return { sales: sum(sales, 'total') - sum(returns, 'refund'), purchases: sum(s.purchases.filter(x => !x.opening && x.time >= since && x.time <= now), 'total'),
      profit: sum(sales, 'profit') - sum(returns, 'profit'), bills: sales.length,
      units: s.lots.filter(l => available(l, now)).reduce((n, l) => n + l.qty, 0),
      value: s.lots.reduce((n, l) => n + l.qty * l.dp, 0),
      low: s.products.filter(p => p.active && stock(s, p.id, now) <= p.reorder),
      expiring: s.lots.filter(l => l.qty > 0 && l.expiry && l.expiry <= day(now + 30 * 86400000)) };
  }
  function validateBackup(s) {
    assert(s && s.schema === 1, 'Unsupported backup format.');
    integer(s.revision, 'backup version');
    for (const key of ['products','lots','purchases','sales','returns','movements','audit']) assert(Array.isArray(s[key]), `Backup missing ${key}.`);
    assert(s.settings && ['markup','margin'].includes(s.settings.pricingMode), 'Invalid backup settings.');
    const productIds = new Set(), codes = new Set(), lotIds = new Set();
    s.products.forEach(p => { productInput(p); assert(typeof p.id === 'string' && !productIds.has(p.id) && !codes.has(p.barcode), 'Duplicate product in backup.'); productIds.add(p.id); codes.add(p.barcode); });
    s.lots.forEach(l => {
      assert(productIds.has(l.productId) && typeof l.id === 'string' && !lotIds.has(l.id) && typeof l.code === 'string' && !codes.has(l.code), 'Invalid batch references.');
      integer(l.qty, 'batch quantity', 1000000); integer(l.quarantine, 'quarantine quantity', 1000000); quote(l, s.settings);
      assert(!l.expiry || validDate(l.expiry), 'Invalid batch expiry.'); lotIds.add(l.id); codes.add(l.code);
    });
    const invoiceIds = new Set(), invoiceNumbers = new Set(), invoiceRequests = new Set();
    s.sales.forEach(x => {
      assert(typeof x.id === 'string' && !invoiceIds.has(x.id) && !invoiceNumbers.has(x.number) && !invoiceRequests.has(x.requestId), 'Duplicate invoice in backup.');
      invoiceIds.add(x.id); invoiceNumbers.add(x.number); invoiceRequests.add(x.requestId);
      assert(Array.isArray(x.lines) && x.store && Number.isFinite(x.time), 'Invalid invoice snapshot.');
      let total = 0, net = 0, cost = 0, tax = 0;
      x.lines.forEach(l => { assert(productIds.has(l.productId) && lotIds.has(l.lotId), 'Invalid invoice product.'); integer(l.qty, 'invoice quantity', 1000000); assert(l.qty > 0, 'Invalid invoice quantity.');
        integer(l.quote.costDp, 'historical cost');
        const base = quote(l.quote, { pricingMode: l.quote.pricingMode });
        const q = { ...base, costDp: l.quote.costDp, profit: base.net - l.quote.costDp };
        assert(quoteEqual(q, l.quote), 'Invalid invoice price snapshot.');
        total += l.qty * q.selling; net += l.qty * q.net; cost += l.qty * q.costDp; tax += l.qty * q.tax;
      });
      assert(x.total === total && x.net === net && x.cost === cost && x.tax === tax && x.profit === net - cost, 'Invoice totals do not reconcile.');
    });
    const returned = new Map();
    s.returns.forEach(r => {
      assert(invoiceIds.has(r.saleId) && lotIds.has(r.lotId), 'Invalid return link.'); integer(r.qty, 'return quantity', 1000000);
      const sale = s.sales.find(x => x.id === r.saleId), line = sale.lines.find(l => l.id === r.lineId);
      assert(line && line.lotId === r.lotId && r.qty > 0 && typeof r.restock === 'boolean' && Number.isFinite(r.time), 'Invalid return snapshot.');
      assert(r.refund === line.quote.selling * r.qty && r.cost === line.quote.costDp * r.qty && r.profit === line.quote.profit * r.qty && r.net === line.quote.net * r.qty, 'Return totals do not reconcile.');
      const key = r.saleId + '/' + r.lineId, quantity = (returned.get(key) || 0) + r.qty;
      assert(quantity <= line.qty, 'Backup returns exceed the sold quantity.'); returned.set(key, quantity);
    });
    const balances = new Map(s.lots.map(l => [l.id, { qty: 0, quarantine: 0 }]));
    const movementIds = new Set();
    s.movements.forEach(m => {
      const lot = s.lots.find(l => l.id === m.lotId);
      assert(lot && lot.productId === m.productId && typeof m.id === 'string' && !movementIds.has(m.id) && Number.isFinite(m.time), 'Invalid stock movement reference.');
      assert(Number.isSafeInteger(m.qty) && m.qty !== 0 && Math.abs(m.qty) <= 1000000, 'Invalid stock movement quantity.');
      assert(['OPENING','PURCHASE','SALE','RETURN','QUARANTINE_RETURN','WRITE_OFF'].includes(m.type), 'Unsupported stock movement.');
      assert(['SALE','WRITE_OFF'].includes(m.type) ? m.qty < 0 : m.qty > 0, 'Stock movement direction is invalid.');
      movementIds.add(m.id); const balance = balances.get(m.lotId);
      if (m.type === 'QUARANTINE_RETURN') balance.quarantine += m.qty;
      else { balance.qty += m.qty; if (m.type === 'WRITE_OFF') balance.quarantine -= m.qty; }
    });
    s.lots.forEach(l => { const b = balances.get(l.id); assert(l.qty === b.qty && l.quarantine === b.quarantine, 'Stock balances do not reconcile with movement history.'); });
    const receiptIds = new Set(), receiptRequests = new Set();
    s.purchases.forEach(p => {
      assert(typeof p.id === 'string' && typeof p.requestId === 'string' && !receiptIds.has(p.id) && !receiptRequests.has(p.requestId) && Number.isFinite(p.time) && Array.isArray(p.lines), 'Invalid purchase receipt.');
      receiptIds.add(p.id); receiptRequests.add(p.requestId); let total = 0;
      p.lines.forEach(l => { assert(productIds.has(l.productId) && lotIds.has(l.lotId), 'Invalid purchase line.'); integer(l.qty, 'purchase quantity', 1000000); assert(l.qty > 0, 'Invalid purchase quantity.'); const q = quote(l, s.settings); assert(l.costInclusive === q.costInclusive, 'Invalid purchase cost.'); total += l.qty * q.costInclusive; });
      assert(total === p.total, 'Purchase totals do not reconcile.');
    });
    assert(s.saleDraft && Array.isArray(s.saleDraft.lines) && s.purchaseDraft && Array.isArray(s.purchaseDraft.lines), 'Backup drafts are missing.');
    assert(typeof s.saleDraft.id === 'string' && typeof s.purchaseDraft.id === 'string', 'Invalid draft identifiers.');
    s.saleDraft.lines.forEach(l => { assert(lotIds.has(l.lotId) && productIds.has(l.productId), 'Invalid draft batch.'); integer(l.qty, 'draft quantity', 1000000); quote(l.quote, { pricingMode: l.quote.pricingMode }); });
    s.purchaseDraft.lines.forEach(l => { assert(productIds.has(l.productId), 'Invalid purchase draft.'); integer(l.qty, 'draft quantity', 1000000); quote(l, s.settings); assert(!l.expiry || validDate(l.expiry), 'Invalid draft expiry.'); });
    return clone(s);
  }
  return { fresh, apply, quote, sellingQuote, adjustmentLot, cents, rate, money, day, resolve, chooseLot, stock, total, metrics, validateBackup, clone, id };
});
