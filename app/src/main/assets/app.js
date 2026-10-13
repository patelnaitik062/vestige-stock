/* Android assets and browser preview share this exact interface and domain core. */
(() => {
  'use strict';
  const C = window.StockCore;
  const K = window.VestigeCatalog;
  const native = typeof window.Android !== 'undefined';
  const appVersion = native ? Android.appVersion() : 'development';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paths = {
    home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    box:'m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10M7.5 5 17 9',
    bill:'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
    scan:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M7 7v10M10 7v10M14 7v10M17 7v10',
    purchase:'M3 4h3l2 12h10l3-9H7M9 21h.01M17 21h.01M13 2v7M10 6l3 3 3-3',
    profit:'M3 17 9 11l4 4 8-10M15 5h6v6',
    chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',
    more:'M5 12h.01M12 12h.01M19 12h.01',
    arrow:'m9 5 7 7-7 7',
    down:'m6 9 6 6 6-6',
    close:'m6 6 12 12M6 18 18 6',
    plus:'M12 5v14M5 12h14',
    check:'m5 12 4 4L19 6',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM8 3l-1 3-3 1v4l2 1-2 1v4l3 1 1 3h4l1-2 1 2h4l1-3 2-1v-4l-2-1 2-1V7l-3-1-1-3h-4l-1 2-1-2Z',
    history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
    shield:'m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 9 3 3 5-6',
    edit:'m4 16-1 5 5-1L20 8l-5-5ZM13 5l6 6',
    store:'M3 9h18l-2-6H5ZM4 9v11h16V9M9 20v-7h6v7M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
    return:'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12h-3',
    info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    leaf:'M20 3C8 2 2 7 5 15c3 7 13 7 15-12ZM4 21 16 8',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.box}"/></svg>`;
  const action = (name, label, cls='btn', extra='') => `<button class="${cls}" data-action="${name}" ${extra}>${label}</button>`;
  const field = (name,label,value='',type='text',hint='',extra='') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${extra}>${hint ? `<span class="help">${hint}</span>` : ''}</label>`;
  const amount = n => (n / 100).toFixed(2);
  const pricingModeLabel = mode => mode === 'dp' ? 'DP + GST (no uplift)' : mode === 'margin' ? 'True 10% margin' : '10% markup';
  const pricingFormula = mode => mode === 'dp' ? 'DP + GST' : mode === 'margin' ? '(DP + GST) ÷ 0.90' : '(DP + GST) × 1.10';
  let state, page='home', period='today', activityTab='sales', productQuery='', productCategory='all', productStock='all', productLimit=60, catalogueLimit=30, activityLimit=30, modalBack=null, pendingMode=null, pendingStockImport=null, pendingCatalogueImport=null, db, toastTimer, chain=Promise.resolve();
  let preview = false;

  const repo = {
    async open() {
      if (native) return;
      db = await new Promise((resolve,reject) => { const r = indexedDB.open('vestige-stock-preview',1); r.onupgradeneeded=()=>r.result.createObjectStore('store'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
    },
    async read() {
      if (native) { const result=JSON.parse(Android.loadState()); if(result.error) throw new Error(result.error); return result.state; }
      return new Promise((resolve,reject)=>{const r=db.transaction('store').objectStore('store').get('state');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});
    },
    async write(next, expected) {
      if (preview) return;
      if (native) { const r=JSON.parse(Android.saveState(JSON.stringify(next),expected)); if(!r.ok) throw new Error(r.error||'Could not save.'); return; }
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('store','readwrite'), store=tx.objectStore('store'), r=store.get('state');
        let conflict=false;
        r.onsuccess=()=>{if((r.result?.revision ?? -1)!==expected){conflict=true;tx.abort();}else store.put(next,'state');};
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error(conflict?'Data changed in another window. Reopen the app.':'Save failed; changes were not committed.'));
      });
    }
  };
  async function dispatch(command, redraw=true) {
    const run = async () => {
      const next=C.apply(state,command);
      if(next!==state){await repo.write(next,state.revision);state=next;}
      if(redraw) render();
      return state;
    };
    const work=chain.then(run);chain=work.catch(()=>{});return work;
  }
  function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3800);}
  function closeModal(){document.getElementById('overlay').innerHTML='';document.body.style.overflow='';modalBack=null;pendingMode=null;pendingStockImport=null;pendingCatalogueImport=null;}
  function sheet(title,body,onClose=null){document.getElementById('overlay').innerHTML=`<div class="sheetback"><section class="sheet" role="dialog" aria-modal="true" aria-label="${escape(title)}"><div class="handle"></div><div class="sheethead"><h2>${escape(title)}</h2>${action('close',icon('close'),'iconbutton','aria-label="Close"')}</div>${body}</section></div>`;document.body.style.overflow='hidden';modalBack=onClose;document.querySelector('.sheet [data-action="close"]')?.focus({preventScroll:true});}
  function bindForm(id,callback){document.getElementById(id).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget, button=form.querySelector('[type=submit]'); if(button.disabled)return;button.disabled=true;try{await callback(new FormData(form));}catch(err){form.querySelector('.formerror').textContent=err.message;}finally{button.disabled=false;}});}
  function formFooter(label){return `<div class="formerror errorbox" role="alert"></div><button class="btn" type="submit">${label}</button>`;}
  function empty(title,body,button,mode){return `<div class="empty"><div class="square">${icon('scan')}</div><h3>${title}</h3><p>${body}</p>${button?action('scan',`${icon('scan')}${button}`,'btn',`data-mode="${mode}"`):''}</div>`;}
  function since(){const d=new Date();if(period==='today')d.setHours(0,0,0,0);else if(period==='month'){d.setDate(1);d.setHours(0,0,0,0);}else return 0;return d.getTime();}
  const friendlyDate = time => new Date(time).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  function productRow(p,low=false){const qty=C.stock(state,p.id),q=C.quote(p,state.settings);return `<div class="productrow"><div class="badge">${icon('box')}</div><div class="grow"><h3>${escape(p.name)}</h3><div class="sub truncate">${escape(p.pack||p.category||p.barcode)}</div>${low?`<span class="pill ${qty===0?'bad':'warn'}">${qty===0?'Out of stock':`${qty} left`}</span>`:`<div class="tiny muted">${p.barcode?escape(p.barcode):`Catalogue ${escape(p.catalogCode)} · no pack barcode linked`}</div>${!p.barcode?action('link-catalog-pack',`${icon('scan')}Link physical pack barcode`,'textbutton',`data-id="${p.id}"`):''}${p.pv!==undefined?`<div class="tiny muted">PV ${escape(amount(p.pv))} · BV ${escape(amount(p.bv||0))}${p.hsn?` · HSN ${escape(p.hsn)}`:''}</div>`:''}`}</div><div class="right"><div class="money">${C.money(q.selling)}</div><div class="tiny muted">MRP ${C.money(p.mrp)}</div>${!low?`<span class="pill ${qty<=p.reorder?'warn':''}">${qty} in stock</span>`:''}</div></div>`;}
  function bars(){
    const totals=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const start=d.getTime(),key=C.day(start);totals.push({key,label:d.toLocaleDateString('en-IN',{weekday:'short'}),value:0});}
    const byDay=new Map(totals.map(day=>[day.key,day]));
    for(const sale of state.sales){const day=byDay.get(C.day(sale.time));if(day)day.value+=sale.total;}
    const max=Math.max(1,...totals.map(x=>x.value));
    return `<div class="bars" role="img" aria-label="Sales over the last seven days">${totals.map(x=>`<div class="barcol" title="${escape(x.label)} · ${C.money(x.value)}" aria-label="${escape(x.label)}: ${C.money(x.value)}"><div class="bar" style="height:${Math.max(4,x.value/max*64)}px"></div><span>${escape(x.label)}</span></div>`).join('')}</div>`;
  }
  function home(){const m=C.metrics(state,since());return `<div class="pagehead"><div class="row between"><div><div class="eyebrow muted">YOUR STORE, AT A GLANCE</div><h1 style="margin-top:6px">Business overview</h1></div></div><p>${escape(state.settings.storeName)} · ${new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</p></div><div class="row between" style="margin-bottom:12px"><span class="eyebrow muted">PERFORMANCE</span><div class="datecontrol">${[['today','Today'],['month','Month'],['all','All time']].map(([key,label])=>action('period',label,period===key?'selected':'',`data-value="${key}"`)).join('')}</div></div>
      <div class="hero"><div class="row between"><span class="muted" style="font-size:12px">Total sales</span><span class="pill">${m.bills} ${m.bills===1?'bill':'bills'}</span></div><div class="money">${C.money(m.sales)}</div><div class="hero-bottom"><div><div class="tiny muted">Gross profit</div><div class="hero-mini money" style="font-size:19px;margin:4px 0 0">${C.money(m.profit)}</div></div><div class="right"><div class="tiny muted">Saleable stock</div><div class="hero-mini">${m.units} <small class="muted">units</small></div></div></div></div>
      <div class="quick">${action('scan',`${icon('scan')}Check price`,'primary','data-mode="price"')}${action('navigate',`${icon('plus')}New bill`,'','data-page="billing"')}${action('navigate',`${icon('purchase')}Receive stock`,'','data-page="purchase"')}${action('scan',`${icon('box')}Add product`,'','data-mode="edit"')}</div>
      <div class="grid2 space"><div class="card statcard"><div class="row between"><span class="tiny muted">Purchases</span><span class="square amber">${icon('purchase')}</span></div><div class="money">${C.money(m.purchases)}</div><div class="tiny muted">Cost including GST</div></div><div class="card statcard"><div class="row between"><span class="tiny muted">Stock value</span><span class="square">${icon('box')}</span></div><div class="money">${C.money(m.value)}</div><div class="tiny muted">At purchase DP</div></div></div>
      ${!state.products.length?`<div class="sectionhead"><h2>Let’s set up your store</h2></div>${empty('Your first scan starts here',`${K.items.length} current Vestige product records are preloaded. Scan a pack and its catalogue QR to fill the product details and prices.`,'Scan your first product','edit')}`:`<div class="sectionhead"><h2>Sales this week</h2><span class="legend"><i></i>Sales</span></div><div class="card">${bars()}</div><div class="sectionhead"><h2>Stock needs attention</h2><span class="pill ${m.low.length?'warn':''}">${m.low.length} products</span></div>${m.low.length?`<div class="card listcard">${m.low.slice(0,4).map(p=>productRow(p,true)).join('')}</div>`:`<div class="note">${icon('check')}Your stock levels look healthy.</div>`}`}
      ${m.expiring.length?`<div class="note warn space">${m.expiring.length} batches are expired or expire within 30 days. ${action('navigate','View inventory','textbutton','data-page="products"')}</div>`:''}`;}
  function catalogRow(p){return `<div class="productrow catalogrow"><div class="badge">${icon('box')}</div><div class="grow"><h3>${escape(p.name)}</h3><div class="sub">${escape(p.pack)}</div><div class="tiny muted">Catalogue ${escape(p.code)} · ${escape(p.category)}</div><span class="pill">Scan pack + catalogue QR to add</span></div><div class="right"><div class="tiny muted">MRP · DP</div><strong class="money smallprice">${C.money(p.referenceMrp)}</strong><div class="tiny muted">${C.money(p.dp)} · PV ${escape(amount(p.pv))}</div></div></div>`;}
  function filteredProducts(){
    const query=productQuery.trim().toLocaleLowerCase('en-IN'),pending=K.pending(state);
    const matches=(p,barcode,code)=>!query||[p.name,p.pack,p.category,barcode,code].some(value=>String(value||'').toLocaleLowerCase('en-IN').includes(query));
    const inCategory=p=>productCategory==='all'||p.category===productCategory;
    const registered=state.products.filter(p=>{
      if(!matches(p,p.barcode,p.catalogCode)||!inCategory(p))return false;
      if(productStock==='inactive')return p.active===false;
      if(p.active===false&&productStock!=='all')return false;
      if(productStock==='needs-link')return !p.barcode;
      if(productStock==='all')return true;
      const qty=C.stock(state,p.id);
      if(productStock==='in-stock')return qty>0;
      if(productStock==='low-stock')return qty>0&&qty<=p.reorder;
      if(productStock==='out-of-stock')return Boolean(p.barcode)&&qty===0;
      return true;
    });
    const catalogue=pending.filter(p=>matches(p,'',p.code)&&inCategory(p)&&
      (productStock==='all'||productStock==='needs-link'));
    return {registered,catalogue,pendingCount:pending.length};
  }
  function productResultsMarkup(){
    const {registered,catalogue,pendingCount}=filteredProducts();
    const shownProducts=registered.slice(0,productLimit),shownCatalogue=catalogue.slice(0,catalogueLimit);
    return `<div class="sectionhead"><h2>Registered products</h2><span class="pill">${registered.length}${registered.length!==state.products.length?` / ${state.products.length}`:''}</span></div>${shownProducts.length?`<div class="card listcard">${shownProducts.map(p=>productRow(p)).join('')}</div>${registered.length>shownProducts.length?action('more-products',`Show ${Math.min(60,registered.length-shownProducts.length)} more registered products`,'btn secondary space'):''}`:'<div class="note">No registered products match these search and filter settings.</div>'}<div class="sectionhead"><h2>Preloaded · awaiting setup</h2><span class="pill">${catalogue.length}${catalogue.length!==pendingCount?` / ${pendingCount}`:''}</span></div>${shownCatalogue.length?`<div class="card listcard">${shownCatalogue.map(catalogRow).join('')}</div>${catalogue.length>shownCatalogue.length?action('more-catalogue',`Show ${Math.min(30,catalogue.length-shownCatalogue.length)} more products`,'btn secondary space'):''}`:'<div class="note">No preloaded products match these search and filter settings.</div>'}`;
  }
  function refreshProductResults(){const target=document.getElementById('product-results');if(target)target.innerHTML=productResultsMarkup();}
  function csvCell(value){
    let text=String(value??'');
    if(/^\s*[=+\-@]/.test(text))text="'"+text;
    return `"${text.replace(/"/g,'""')}"`;
  }
  function exportProductsCsv(){
    const {registered,catalogue}=filteredProducts();
    const columns=['barcode','catalog_code','product_name','pack','category','stock','dp','mrp','gst_percent','pv','bv','hsn','active'];
    const rows=[columns];
    for(const p of registered)rows.push([p.barcode,p.catalogCode||'',p.name,p.pack,p.category,C.stock(state,p.id),amount(p.dp),amount(p.mrp),p.gstBps/100,p.pv===undefined?'':amount(p.pv),p.bv===undefined?'':amount(p.bv),p.hsn||'',p.active?'yes':'no']);
    for(const p of catalogue)rows.push(['',p.code,p.name,p.pack,p.category,0,amount(p.dp),amount(p.referenceMrp),p.gstBps/100,amount(p.pv),amount(p.bv),p.hsn||'','pending barcode link']);
    if(rows.length===1){toast('No products match the current filters. Nothing was exported.');return;}
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
    if(native)Android.exportProductsCsv(csv);
    else download(`Vestige-Products-${C.day()}.csv`,csv,'text/csv');
  }
  function products(){
    const pending=K.pending(state),categories=[...new Set([...state.products.map(p=>p.category),...K.items.map(p=>p.category)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'en-IN'));
    return `<div class="pagehead"><div class="row between"><h1>Products</h1><span class="pill">${state.products.length+pending.length} total</span></div><p>Find products, check stock, or scan a pack to manage it.</p></div>${action('scan',`${icon('scan')}<span class="grow"><strong>Scan to add or edit</strong><small>Link a pack barcode or manage a saved product</small></span>${icon('arrow')}`,'scanbanner','data-mode="edit"')}<div class="note space">${K.items.length} official products · catalogue refreshed ${escape(K.version)}. Scan a physical pack, then its catalogue QR to prefill size, MRP, DP, GST, PV, BV and HSN. Confirm pack values before saving.</div><div class="productfilters card space"><label class="field productsearch"><span>Search products</span><input id="product-search" type="search" value="${escape(productQuery)}" placeholder="Name, barcode, pack, category or code" aria-label="Search products by name, barcode, pack, category or catalogue code" autocomplete="off"></label><label class="field"><span>Category</span><select id="product-category" aria-label="Filter products by category"><option value="all">All categories</option>${categories.map(category=>`<option value="${escape(category)}" ${productCategory===category?'selected':''}>${escape(category)}</option>`).join('')}</select></label><label class="field"><span>Stock status</span><select id="product-stock" aria-label="Filter products by stock status">${[['all','All products'],['in-stock','In stock'],['low-stock','Low stock'],['out-of-stock','Out of stock'],['needs-link','Needs barcode link'],['inactive','Inactive']].map(([value,label])=>`<option value="${value}" ${productStock===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="btnrow space">${action('import-catalogue',`${icon('upload')}Import zero-stock catalogue CSV`,'btn secondary')}${action('export-products',`${icon('download')}Export filtered CSV`,'btn secondary')}</div><div class="note space">Catalogue CSV adds zero-stock rows; JSON backup restores the complete store. Search matches saved products and unlinked catalogue references.</div>${action('catalog-help',`${icon('info')}How catalogue linking works`,'btn secondary space')}<div id="product-results">${productResultsMarkup()}</div><div class="note space">Reference MRPs include all taxes. The MRP printed on the received pack takes priority. Catalogue reference codes are separate from pack barcodes.</div>`;
  }
  function catalogHelp(){sheet('Use the preloaded catalogue',`<div class="card"><h3>Set up once. Scan every day.</h3><p class="sub">1. Scan the barcode on your physical product.</p><p class="sub">2. Choose “Scan catalogue QR”, then scan its matching QR from the catalogue PDF on another screen or a printed page.</p><p class="sub">3. Review the prefilled product, pack, MRP, DP, GST, PV, BV and HSN against the pack and invoice.</p><p class="sub">4. Save. Stock stays at zero until you receive a purchase.</p></div><div class="note space">The catalogue QR is an app reference, not a manufacturer barcode. For an existing product, linking only adds its catalogue reference and does not overwrite its saved prices or stock.</div>${action('scan',`${icon('scan')}Scan pack barcode`,'btn space','data-mode="edit"')}`);}

  function billing(){
    const d=state.saleDraft;
    return `<div class="pagehead"><div class="row between"><h1>New bill</h1>${d.lines.length?action('clear-sale','Clear','textbutton'):''}</div><p>Scan. Review. Complete.</p></div>${action('scan',`${icon('scan')}<span class="grow"><strong>Scan product</strong><small>Each scan adds one unit to this bill</small></span>${icon('plus')}`,'scanbanner','data-mode="bill"')}${action('pricing-settings',`Selling plan · ${escape(pricingModeLabel(state.settings.pricingMode))}`,'btn secondary space')}<div class="sectionhead"><h2>Items in this bill</h2><span class="pill">${d.lines.reduce((n,l)=>n+l.qty,0)} units</span></div>${d.lines.length?`<div class="card">${d.lines.map(l=>`<div class="cartline"><div class="row between"><div class="grow"><h3>${escape(l.name)}</h3><div class="sub">${escape(l.pack)} · Batch ${escape(l.batch)}</div></div><strong class="money smallprice">${C.money(l.quote.selling*l.qty)}</strong></div><div class="row between"><div class="quantity">${action('quantity','−','',`data-id="${l.id}" data-qty="${l.qty-1}" aria-label="Reduce quantity"`)}<span>${l.qty}</span>${action('quantity','+','',`data-id="${l.id}" data-qty="${l.qty+1}" aria-label="Increase quantity"`)}</div><div class="tiny muted">${C.money(l.quote.selling)} each<br>MRP ${C.money(l.quote.mrp)}</div></div></div>`).join('')}</div><div class="billtotal"><div class="row between"><span class="sub">Amount to collect</span><span class="pill">GST included</span></div><div class="money">${C.money(C.total(state))}</div>${action('checkout',`${icon('check')}Review & complete bill`,'btn lime')}</div><div class="itemactions"><span class="tiny muted">Draft saved automatically</span>${action('refresh-prices','Refresh prices','textbutton')}</div>`:empty('Ready for your next sale','Scan a product with available stock. Its selling price is calculated automatically.','Scan product','bill')}<div class="note space">${escape(pricingModeLabel(state.settings.pricingMode))}. Selling price includes GST; GST is not added again at checkout. GST and the applicable pricing plan are saved with each completed bill.</div>`;
  }
  function purchase(){const d=state.purchaseDraft;return `<div class="pagehead"><div class="row between"><h1>Receive stock</h1>${d.lines.length?action('clear-purchase','Clear','textbutton'):''}</div><p>Scan items or import up to 500 rows from a reviewed CSV.</p></div>${action('scan',`${icon('scan')}<span class="grow"><strong>Scan incoming product</strong><small>Add batch, quantity and purchase DP</small></span>${icon('plus')}`,'scanbanner','data-mode="receive"')}<div class="grid2 space">${action('import-stock',`${icon('upload')}Import stock CSV`,'btn secondary')}${action('stock-template',`${icon('download')}CSV template`,'btn secondary')}</div><div class="note space">CSV columns: barcode, quantity, batch, expiry, dp, mrp, gst. Batch price fields may be left blank to use the registered values; batch number and required expiry should be supplied. Imports are previewed and validated before they are added.</div><div class="sectionhead"><h2>Receipt items</h2><span class="pill">${d.lines.length} lines</span></div>${d.lines.length?`<div class="card">${d.lines.map(l=>`<div class="cartline"><div class="row between"><div class="grow"><h3>${escape(l.name)}</h3><div class="sub">${l.qty} × ${C.money(C.quote(l,state.settings).costInclusive)} · ${escape(l.batch)}</div><div class="tiny muted">${l.expiry?'Expires '+escape(l.expiry):'No expiry recorded'}</div></div>${action('remove-purchase',icon('close'),'iconbutton',`data-id="${l.id}" aria-label="Remove item"`)}</div></div>`).join('')}</div><div class="billtotal"><span class="sub">Purchase cost including GST</span><div class="money">${C.money(d.lines.reduce((n,l)=>n+C.quote(l,state.settings).costInclusive*l.qty,0))}</div>${action('post-purchase',`${icon('check')}Confirm receipt`,'btn lime')}</div>`:empty('No incoming items yet','Scan products or import a stock CSV to start a receipt.','Scan incoming product','receive')}`;}
  function activity(){
    const list=activityTab==='sales'?state.sales:state.purchases,visible=list.slice(-activityLimit).reverse();
    return `<div class="pagehead"><h1>Activity</h1><p>Every bill. Every purchase. All in one place.</p></div><div class="tabs" role="tablist" aria-label="Activity type">${action('activity-tab','Sales bills',activityTab==='sales'?'selected':'',`data-value="sales" role="tab" aria-selected="${activityTab==='sales'}"`)}${action('activity-tab','Purchases',activityTab==='purchases'?'selected':'',`data-value="purchases" role="tab" aria-selected="${activityTab==='purchases'}"`)}</div>${visible.length?`<div class="card listcard">${visible.map(x=>action(activityTab==='sales'?'invoice':'receipt',`<span class="square ${activityTab==='purchases'?'amber':''}">${icon(activityTab==='sales'?'bill':'purchase')}</span><span class="grow"><h3>${escape(x.number)}</h3><span class="sub">${friendlyDate(x.time)} · ${escape(x.customer||x.supplier||(x.opening?'Opening stock':activityTab==='sales'?'Walk-in customer':'Stock receipt'))}</span></span><span class="right"><strong class="money smallprice">${C.money(x.total)}</strong><br><small class="muted">${x.lines.reduce((n,l)=>n+l.qty,0)} units</small></span>${icon('arrow')}`,'activityrow receiptbutton',`data-id="${x.id}"`)).join('')}</div>${list.length>visible.length?action('more-activity',`Show ${Math.min(activityLimit,list.length-visible.length)} older records`,'btn secondary space'):''}`:empty(activityTab==='sales'?'No completed bills':'No purchases yet',activityTab==='sales'?'Your completed sales and PDF invoices will appear here.':'Confirmed stock receipts will appear here.')}`;
  }
  function settingRow(actionName,name,label,desc){return action(actionName,`<span class="square">${icon(name)}</span><span class="grow"><strong>${label}</strong><small>${desc}</small></span>${icon('arrow')}`,'settingrow');}
  function more(){const m=C.metrics(state);return `<div class="pagehead"><h1>Your store</h1><p>Simple settings for your daily business.</p></div><div class="card row"><div class="brandmark">${icon('store')}</div><div class="grow"><h3>${escape(state.settings.storeName)}</h3><div class="sub">Offline · On this device</div></div></div><div class="sectionhead"><h2>Manage</h2></div><div class="card listcard">${settingRow('store-settings','store','Store details','Name, address and invoice information')}${settingRow('pricing-settings','profit','Selling price plan',pricingModeLabel(state.settings.pricingMode))}${settingRow('reports','chart','Reports & stock alerts',`${m.units} units · ${m.low.length} low-stock products`)}${settingRow('adjust','box','Stock write-off','Scan a batch and record a reason')}${settingRow('backup','download','Export backup','Products, stock, bills and settings')}${settingRow('restore','upload','Restore backup','Review a saved backup before replacing data')}</div><div class="note space">Your data stays on this device. Export a backup before changing phones or uninstalling the app.</div><div class="settingsfooter">Vestige Stock · v${escape(appVersion)}<br>Independent distributor inventory application</div>`;}
  function render(){if(!state)return;const pages={home,products,billing,purchase,activity,more};document.getElementById('app').innerHTML=`<div class="shell">${preview?'<div class="demo-banner">UI PREVIEW · SAMPLE DATA ONLY</div>':''}<header class="topbar"><div class="brand"><span class="brandmark">${icon('leaf')}</span>vestige<span style="font-weight:400;color:var(--muted);margin-left:-6px">stock</span></div><span class="status"><span class="dot"></span>Offline ready</span></header><main class="content">${pages[page]()}</main><nav class="bottomnav" aria-label="Main navigation">${[['home','home','Home'],['products','box','Products'],['billing','scan','Billing'],['activity','history','Activity'],['more','more','More']].map(([p,i,t])=>action('navigate',`<span class="navicon">${icon(i)}</span><span>${t}</span>`,page===p?'active':'',`data-page="${p}" ${page===p?'aria-current="page"':''}`)).join('')}</nav></div>`;}
  function navigate(p){closeModal();page=p;render();window.scrollTo({top:0,behavior:'instant'});}
  function scan(mode,extra={}){pendingMode={mode,...extra};sheet(mode==='catalog-link'?'Scan catalogue QR':mode==='price'?'Check price':mode==='edit'?'Scan product':mode==='receive'?'Receive product':mode==='return'?'Scan returned product':'Scan barcode',`<div class="scanbox">${icon('scan')}<strong>${mode==='catalog-link'?'Scan the matching QR from the catalogue PDF':'Point at the pack barcode'}</strong><small>${native?'Use your camera or a connected barcode scanner.':'Connect a barcode scanner. Camera scanning is available in the Android app.'}</small></div>${native?action('camera',`${icon('scan')}Open camera`):''}<div class="note space">The scan will only apply to this operation. No product-name search is needed.</div>`);pendingMode={mode,...extra};}
  function launchCamera(){if(native&&pendingMode)Android.scanBarcode(JSON.stringify(pendingMode));}
  async function onScan(code,context){const ctx=context||pendingMode;if(!ctx)return;closeModal();try{
    if(ctx.mode==='link-product'){
      const current=state.products.find(p=>p.id===ctx.productId);
      if(!current||current.barcode||!current.catalogCode)throw new Error('This catalogue product is already linked or no longer available.');
      if(String(code).startsWith('VSCAT:'))throw new Error('Scan the barcode on the physical pack, not a catalogue QR.');
      if(C.resolve(state,code).product)throw new Error('This physical barcode is already registered.');
      productForm(code,{...current,barcode:code});return;
    }
    if(ctx.mode==='catalog-link'){
      const item=K.lookup(code);if(!item)throw new Error('Scan a setup QR from the supplied Vestige catalogue PDF.');
      const current=C.resolve(state,ctx.barcode).product;
      const unlinked=state.products.find(p=>p.catalogCode===item.code&&!p.barcode);
      const target=current||unlinked;
      if(state.products.some(p=>p.catalogCode===item.code&&p.id!==target?.id))throw new Error('This catalogue entry is already linked. Scan its registered pack barcode.');
      if(current?.catalogCode&&current.catalogCode!==item.code)throw new Error('This product is already linked to a different catalogue entry.');
      productForm(ctx.barcode,target?{...target,barcode:ctx.barcode,catalogCode:item.code}:null,item);return;
    }
    if(String(code).startsWith('VSCAT:'))throw new Error('This is a catalogue setup QR. Scan the physical pack barcode first, then choose Scan catalogue QR.');
    const result=C.resolve(state,code);
    if(!result.product){sheet('Product not registered',`<div class="note">Scanned barcode: <strong>${escape(code)}</strong></div><p class="sub space">Scan the matching catalogue QR to fill in the product name, pack, category, MRP, DP and GST. Review the values against the physical pack and invoice before saving.</p>${action('catalog-link',`${icon('scan')}Scan catalogue QR`,'btn space',`data-code="${escape(code)}"`)}${action('register',`${icon('plus')}Register product`,'btn space',`data-code="${escape(code)}"`)}<div class="note space">Registration does not add stock. Receive a purchase to make the product available for sale.</div>`);return;}
    if(ctx.mode==='edit')productDetail(result.product,result.lot);
    else if(ctx.mode==='price')priceCheck(result.product,result.lot);
    else if(ctx.mode==='receive')receiveForm(result.product);
    else if(ctx.mode==='bill'){await dispatch({type:'SCAN_SALE',code});navigate('billing');toast(`${result.product.name} added`);}
    else if(ctx.mode==='return')returnForm(ctx.saleId,code);
    else if(ctx.mode==='adjust')adjustForm(code);
  }catch(e){toast(e.message);}}
  window.onNativeEvent=async function(event){if(event.type==='scan')await onScan(event.code,JSON.parse(event.context));else if(event.type==='message')toast(event.message);else if(event.type==='restore')restorePreview(event.text);else if(event.type==='stock-import')previewStockCsv(event.text);else if(event.type==='catalogue-import')previewCatalogueCsv(event.text);else if(event.type==='back'){if(document.getElementById('overlay').children.length)closeModal();else if(page!=='home')navigate('home');else if(native)Android.finishApp();}};
  function priceCheck(p,lot){
    const lots=state.lots.filter(l=>l.productId===p.id&&l.qty>0);
    if(!lot&&lots.length>1){sheet('Choose the correct batch',`<h3>${escape(p.name)}</h3><p class="sub">This product has multiple batches. Scan its internal batch label for the exact price.</p>${lots.map(l=>`<div class="batch"><div class="row between"><strong>Batch ${escape(l.batch)}</strong><span class="pill">${l.qty} units</span></div><div class="line"><span>MRP</span><strong>${C.money(l.mrp)}</strong></div><div class="line"><span>Selling price</span><strong>${C.money(C.sellingQuote(state,l).selling)}</strong></div><small class="muted">Expiry ${escape(l.expiry||'not set')}</small></div>`).join('')}${action('scan',`${icon('scan')}Scan batch label`,'btn space','data-mode="price"')}`);return;}
    const chosen=lot||lots[0],q=chosen?C.sellingQuote(state,chosen):C.quote(p,state.settings);
    sheet('Price check',`<div class="row"><div class="badge square">${icon('box')}</div><div><h2>${escape(p.name)}</h2><div class="sub">${escape(p.pack)} · ${escape(p.barcode)}</div></div></div><div class="pricepanel"><div class="eyebrow">${escape(pricingModeLabel(q.pricingMode))}</div><div class="money">${C.money(q.selling)}</div><div class="line"><span>MRP</span><strong>${C.money(q.mrp)}</strong></div><div class="line"><span>DP before GST</span><strong>${C.money(q.dp)}</strong></div><div class="line"><span>GST on DP (${q.gstBps/100}%)</span><strong>${C.money(q.gstOnDp)}</strong></div><div class="formula">${pricingFormula(q.pricingMode)}</div></div><div class="row between space"><span class="pill">${C.stock(state,p.id)} saleable units</span><span class="tiny muted">${chosen?'Batch '+escape(chosen.batch):'Saved reference price'}</span></div>${q.overMrp?'<div class="note bad space">Calculated price is above MRP. Correct prices before billing.</div>':''}${action('scan',`${icon('scan')}Check another price`,'btn space','data-mode="price"')}`);
  }
  function productDetail(p,lot){
    const lots=lot?[lot]:state.lots.filter(l=>l.productId===p.id);
    const facts=p.catalogCode?`<div class="card space"><div class="line"><span>Distributor price</span><strong>${C.money(p.distributorPrice||0)}</strong></div><div class="line"><span>PV / BV</span><strong>${escape(amount(p.pv||0))} / ${escape(amount(p.bv||0))}</strong></div><div class="line"><span>GST / HSN</span><strong>${escape(String(p.gstBps/100))}% / ${escape(p.hsn||'—')}</strong></div><div class="line"><span>Category</span><strong>${escape(p.category||'—')}</strong></div></div>`:'';
    sheet('Product details',`<h2>${escape(p.name)}</h2><p class="sub">${escape(p.pack)} · ${escape(p.barcode)}</p><div class="grid2 space"><div class="card"><small class="muted">Current DP</small><h2>${C.money(p.dp)}</h2></div><div class="card"><small class="muted">Catalog MRP</small><h2>${C.money(p.mrp)}</h2></div></div>${facts}${action('edit-product',`${icon('edit')}Edit product & pricing`,'btn space',`data-id="${p.id}"`)}${!p.catalogCode?action('catalog-link',`${icon('scan')}Link catalogue entry`,'btn secondary space',`data-code="${escape(p.barcode)}"`):`<div class="note space">Catalogue reference: ${escape(p.catalogCode)}</div>`}<div class="sectionhead"><h2>Stock batches</h2><span class="pill">${C.stock(state,p.id)} units</span></div>${lots.length?lots.map(l=>`<div class="batch"><div class="row between"><strong>${escape(l.batch)}</strong><span class="pill ${l.expiry&&l.expiry<C.day()?'bad':''}">${l.qty} units</span></div><div class="line"><span>Purchase DP / batch MRP</span><strong>${C.money(l.dp)} / ${C.money(l.mrp)}</strong></div><div class="line"><span>Expiry</span><strong>${escape(l.expiry||'Not recorded')}</strong></div><div class="itemactions">${action('lot-label','Save batch label','textbutton',`data-id="${l.id}"`)}${action('edit-lot','Correct MRP','textbutton',`data-id="${l.id}"`)}</div><small class="muted">${escape(l.code)}</small></div>`).join(''):'<div class="note">Receive stock to create your first batch.</div>'}`);
  }
  function productForm(code,existing,catalogEntry){
    let p=existing?{...existing}:catalogEntry?K.prefill(catalogEntry,code):{barcode:code,name:'',pack:'',category:'',dp:0,mrp:0,gstBps:null,reorder:5,expiryRequired:true,active:true};
    if(catalogEntry)for(const key of ['distributorPrice','pv','bv','hsn'])if(p[key]===undefined)p[key]=catalogEntry[key];
    const facts=catalogEntry?`<div class="card space"><div class="line"><span>Distributor price</span><strong>${C.money(catalogEntry.distributorPrice)}</strong></div><div class="line"><span>PV / BV</span><strong>${escape(amount(catalogEntry.pv))} / ${escape(amount(catalogEntry.bv))}</strong></div><div class="line"><span>GST / HSN</span><strong>${escape(String(catalogEntry.gstBps/100))}% / ${escape(catalogEntry.hsn)}</strong></div></div>`:'';
    sheet(existing?'Edit product':'Register product',`<form id="product-form">${catalogEntry?`<div class="note space">Catalogue ${escape(catalogEntry.code)} · ${escape(catalogEntry.name)} · ${escape(catalogEntry.pack)}. Values are prefilled from the latest official catalogue snapshot. Check current MRP and purchase DP against your pack/invoice before saving. ${existing?'Your saved name, pack and prices are retained.':'Stock stays at zero until you receive a purchase.'}</div>${facts}`:''}${field('barcode','Scanned physical barcode',p.barcode,'text','','readonly')}${field('name','Product name',p.name,'text','','required maxlength="120"')}${field('pack','Pack size',p.pack,'text','For example: 60 capsules or 100 ml','maxlength="60"')}<div class="grid2">${field('dp','DP before GST',p.dp?amount(p.dp):'','text','','inputmode="decimal" required')}${field('mrp','MRP',p.mrp?amount(p.mrp):'','text','','inputmode="decimal" required')}${field('gst','GST %',p.gstBps===null?'':p.gstBps/100,'text','','inputmode="decimal" required')}${field('reorder','Low-stock level',p.reorder,'number','','min="0" max="1000000" required')}</div>${field('category','Category',p.category,'text','','maxlength="60"')}<label class="checkrow"><input type="checkbox" name="expiry" ${p.expiryRequired?'checked':''}>Track expiry for this product</label>${existing?`<label class="checkrow"><input type="checkbox" name="active" ${p.active?'checked':''}>Product is active</label>`:''}<div id="live-price" class="pricepanel"><small>Enter DP, GST and MRP to calculate the selling price.</small></div><div class="note space">Selected selling plan: ${escape(pricingModeLabel(state.settings.pricingMode))}. DP excludes GST. Changing prices affects future bills only; received batch costs and completed bills stay unchanged.</div>${formFooter('Save product')}</form>`);
    const f=document.getElementById('product-form');
    const update=()=>{try{const v=new FormData(f),q=C.quote({dp:C.cents(v.get('dp')),mrp:C.cents(v.get('mrp')),gstBps:C.rate(v.get('gst'))},state.settings);document.getElementById('live-price').innerHTML=`<small>Calculated selling price · GST included</small><div class="money">${C.money(q.selling)}</div><div class="formula">${pricingFormula(q.pricingMode)} · ${pricingModeLabel(q.pricingMode)}</div>${q.overMrp?'<div class="errorbox">Above MRP — billing will be blocked until corrected.</div>':''}`;}catch{document.getElementById('live-price').innerHTML='<small>Enter valid DP, GST and MRP values.</small>';}}
    f.addEventListener('input',update);update();
    bindForm('product-form',async v=>{await dispatch({type:'SAVE_PRODUCT',product:{...p,id:p.id,barcode:p.barcode,catalogCode:p.catalogCode,name:v.get('name'),pack:v.get('pack'),category:v.get('category'),dp:C.cents(v.get('dp')),mrp:C.cents(v.get('mrp')),gstBps:C.rate(v.get('gst')),reorder:Number(v.get('reorder')),expiryRequired:v.has('expiry'),active:existing?v.has('active'):true,distributorPrice:p.distributorPrice,pv:p.pv,bv:p.bv,hsn:p.hsn}});closeModal();toast(catalogEntry?'Catalogue linked. Stock is unchanged.':'Product saved');});
  }
  function receiveForm(p){sheet('Receive product',`<h3>${escape(p.name)}</h3><p class="sub">${escape(p.barcode)}</p><form id="receive-form"><div class="grid2">${field('qty','Quantity',1,'number','','min="1" max="1000000" required')}${field('dp','Purchase DP before GST',amount(p.dp),'text','','inputmode="decimal" required')}${field('mrp','Printed batch MRP',amount(p.mrp),'text','','inputmode="decimal" required')}${field('gst','Purchase GST %',p.gstBps/100,'text','','inputmode="decimal" required')}</div>${field('batch','Batch number','','text','','maxlength="80" required')}${field('expiry','Expiry date','','date',p.expiryRequired?'Required for this product':'Optional for this product',p.expiryRequired?'required':'')}<div class="note">Enter the actual purchase DP. Current selling prices use the DP saved on the product.</div>${formFooter('Add to receipt')}</form>`);bindForm('receive-form',async v=>{await dispatch({type:'PURCHASE_LINE',line:{productId:p.id,qty:Number(v.get('qty')),dp:C.cents(v.get('dp')),mrp:C.cents(v.get('mrp')),gstBps:C.rate(v.get('gst')),batch:v.get('batch'),expiry:v.get('expiry')}});navigate('purchase');toast('Added to stock receipt');});}
  function parseCsvRows(text){
    if(text.length>2*1024*1024)throw new Error('CSV files must be smaller than 2 MB.');
    const rows=[];let row=[],value='',quoted=false,closedQuote=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){if(ch==='"'&&text[i+1]==='"'){value+='"';i++;}else if(ch==='"'){quoted=false;closedQuote=true;}else value+=ch;continue;}
      if(ch==='"'){if(value||closedQuote)throw new Error('Unexpected quote in CSV. Use double quotes around fields that contain commas.');quoted=true;}
      else if(ch===','){row.push(value.trim());value='';closedQuote=false;}
      else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';closedQuote=false;}
      else {if(closedQuote)throw new Error('Unexpected text after a quoted CSV field.');value+=ch;}
    }
    if(quoted)throw new Error('CSV ends inside a quoted field.');
    row.push(value.trim());if(row.some(Boolean))rows.push(row);
    if(rows.length<2)throw new Error('CSV must contain a header and at least one data row.');
    const headers=rows.shift().map((x,i)=>(i===0?x.replace(/^\uFEFF/,''):x).toLowerCase().replace(/[\s_-]/g,''));
    if(new Set(headers).size!==headers.length)throw new Error('CSV column names must be unique.');
    if(rows.length>500)throw new Error('Import up to 500 rows at a time.');
    rows.forEach((cells,i)=>{if(cells.length!==headers.length)throw new Error(`CSV row ${i+2}: row has a different number of columns than the header.`);});
    return {headers,rows};
  }
  function parseStockCsv(text){
    const {headers,rows}=parseCsvRows(text);
    const column=(...names)=>headers.findIndex(x=>names.includes(x));
    const barcode=column('barcode','packbarcode','productbarcode'),quantity=column('quantity','qty');
    if(barcode<0||quantity<0)throw new Error('CSV must have barcode and quantity columns.');
    const index={barcode,quantity,batch:column('batch','batchnumber','lot'),expiry:column('expiry','expirydate'),dp:column('dp','purchaseDP'.toLowerCase()),mrp:column('mrp','batchmrp'),gst:column('gst','gstpercent','gst%')};
    const imported=[];
    rows.forEach((cells,i)=>{
      const valueAt=key=>index[key]<0?'':String(cells[index[key]]||'').trim();
      try{
        const code=valueAt('barcode'),p=state.products.find(x=>x.barcode===code);
        if(!p)throw new Error(`Barcode ${code||'(blank)'} is not a registered physical pack.`);
        if(!p.active)throw new Error(`${p.name} is inactive.`);
        const qtyText=valueAt('quantity');
        if(!/^[1-9]\d*$/.test(qtyText))throw new Error('Quantity must be a positive whole number.');
        const batch=valueAt('batch');
        if(!batch)throw new Error('Batch number is required.');
        imported.push({productId:p.id,qty:Number(qtyText),dp:C.cents(valueAt('dp')||amount(p.dp)),mrp:C.cents(valueAt('mrp')||amount(p.mrp)),gstBps:C.rate(valueAt('gst')||String(p.gstBps/100)),batch,expiry:valueAt('expiry')});
      }catch(error){throw new Error(`CSV row ${i+2}: ${error.message}`);}
    });
    return imported;
  }
  function parseCatalogueCsv(text){
    const {headers,rows}=parseCsvRows(text);
    const column=(...names)=>headers.findIndex(x=>names.includes(x));
    const index={code:column('catalogcode'),name:column('productname','name'),pack:column('pack','size'),category:column('category'),mrp:column('mrp'),dp:column('dp'),gst:column('gstpercent','gst'),distributor:column('distributorprice'),pv:column('pv'),bv:column('bv'),hsn:column('hsn'),stock:column('stock','quantity')};
    for(const key of ['code','name','pack','category','mrp','dp','gst','stock'])if(index[key]<0)throw new Error(`Catalogue CSV is missing the ${key} column.`);
    const products=[];
    rows.forEach((cells,i)=>{
      const value=key=>index[key]<0?'':String(cells[index[key]]||'').trim();
      try{
        const code=value('code').toUpperCase(),entry=K.items.find(item=>item.code===code);
        if(!entry)throw new Error(`Unknown catalogue code ${code||'(blank)'}.`);
        if(!value('name')||!value('pack')||!value('category'))throw new Error('Product name, pack and category are required.');
        if(!/^0(?:\.0+)?$/.test(value('stock')))throw new Error('Catalogue imports must have zero stock; receive stock separately.');
        if(value('name')!==entry.name||value('pack')!==entry.pack||value('category')!==entry.category||
          C.cents(value('mrp'))!==entry.referenceMrp||C.cents(value('dp'))!==entry.dp||
          C.rate(value('gst'))!==entry.gstBps||
          index.distributor>=0&&C.cents(value('distributor'))!==entry.distributorPrice||
          index.pv>=0&&C.cents(value('pv'))!==entry.pv||
          index.bv>=0&&C.cents(value('bv'))!==entry.bv||
          index.hsn>=0&&value('hsn')!==entry.hsn)throw new Error('Product details do not match the bundled official catalogue.');
        const product={barcode:'',catalogCode:code,name:value('name'),pack:value('pack'),category:value('category'),
          mrp:C.cents(value('mrp')),dp:C.cents(value('dp')),gstBps:C.rate(value('gst')),reorder:5,
          expiryRequired:!['Business Tools','Fashion Accessories','Sharp Appliance','Others'].includes(value('category')),active:true};
        if(value('distributor'))product.distributorPrice=C.cents(value('distributor'));
        if(value('pv'))product.pv=C.cents(value('pv'));
        if(value('bv'))product.bv=C.cents(value('bv'));
        if(value('hsn'))product.hsn=value('hsn');
        products.push(product);
      }catch(error){throw new Error(`CSV row ${i+2}: ${error.message}`);}
    });
    if(new Set(products.map(product=>product.catalogCode)).size!==products.length)throw new Error('Catalogue CSV contains duplicate product codes.');
    return products;
  }
  function previewStockCsv(text){
    try{
      const lines=parseStockCsv(String(text||'')),preview=C.apply(state,{type:'IMPORT_PURCHASE_LINES',lines}),newLines=preview.purchaseDraft.lines.slice(state.purchaseDraft.lines.length);
      const total=newLines.reduce((sum,line)=>sum+C.quote(line,state.settings).costInclusive*line.qty,0);
      pendingStockImport=lines;
      sheet('Review stock import',`<div class="note">${lines.length} rows validated · ${lines.reduce((n,l)=>n+l.qty,0)} units. Nothing has been saved yet. This will append to the current receipt.</div><div class="card space">${newLines.slice(0,12).map(l=>`<div class="line"><span>${escape(l.name)} · ${escape(l.batch)} × ${l.qty}</span><strong>${C.money(C.quote(l,state.settings).costInclusive*l.qty)}</strong></div>`).join('')}${newLines.length>12?`<div class="tiny muted">${newLines.length-12} more rows</div>`:''}<div class="line total"><span>Imported receipt cost (incl. GST)</span><strong>${C.money(total)}</strong></div></div>${action('confirm-stock-import',`${icon('check')}Add validated rows to receipt`,'btn lime space')}${action('close','Cancel import','btn secondary space')}`);
    }catch(error){pendingStockImport=null;toast(`Stock CSV not imported: ${error.message}`);}
  }
  function requestStockImport(){
    if(native){Android.importStockCsv();return;}
    const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv,text/plain';
    input.onchange=async()=>{try{if(input.files[0])previewStockCsv(await input.files[0].text());}catch(error){toast(`Could not read CSV: ${error.message}`);}};
    input.click();
  }
  function previewCatalogueCsv(text){
    try{
      const products=parseCatalogueCsv(String(text||'')),preview=C.apply(state,{type:'IMPORT_CATALOGUE_PRODUCTS',products});
      pendingCatalogueImport=products;
      const list=preview.products.slice(state.products.length);
      sheet('Review catalogue import',`<div class="note">${products.length} products validated. Nothing has been saved yet. Products will be added without a physical barcode and with zero stock.</div><div class="card space">${list.slice(0,10).map(p=>`<div class="line"><span>${escape(p.name)} · ${escape(p.pack)}</span><strong>${escape(p.catalogCode)}</strong></div>`).join('')}${list.length>10?`<div class="tiny muted">${list.length-10} more products</div>`:''}<div class="line total"><span>Initial stock</span><strong>0 units</strong></div></div><div class="note warn">Each product must be linked to its real pack barcode before it can be scanned for stock or billing. This adds products; it does not replace your backup or existing data.</div>${action('confirm-catalogue-import',`${icon('check')}Add ${products.length} products at zero stock`,'btn lime space')}${action('close','Cancel import','btn secondary space')}`);
    }catch(error){pendingCatalogueImport=null;toast(`Catalogue CSV not imported: ${error.message}`);}
  }
  function requestCatalogueImport(){
    if(native){Android.importCatalogueCsv();return;}
    const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv,text/plain';
    input.onchange=async()=>{try{if(input.files[0])previewCatalogueCsv(await input.files[0].text());}catch(error){toast(`Could not read catalogue CSV: ${error.message}`);}};
    input.click();
  }
  function stockTemplate(){const csv='barcode,quantity,batch,expiry,dp,mrp,gst\n';if(native)Android.exportStockTemplate();else download('Vestige-Stock-Import-Template.csv',csv,'text/csv');}
  function postPurchase(){const d=state.purchaseDraft;sheet('Confirm stock receipt',`<form id="post-form">${field('supplier','Supplier',d.supplier,'text','','maxlength="120"')}${field('reference','Supplier invoice reference',d.reference,'text','','maxlength="80"')}<label class="checkrow"><input type="checkbox" name="opening" ${d.opening?'checked':''}>This is existing opening stock</label><div class="note">Opening stock adds inventory without increasing this period’s purchases.</div><div class="line total"><span>Amount including GST</span><strong>${C.money(d.lines.reduce((n,l)=>n+C.quote(l,state.settings).costInclusive*l.qty,0))}</strong></div>${formFooter('Confirm & add stock')}</form>`);bindForm('post-form',async v=>{await dispatch({type:'PURCHASE_META',supplier:v.get('supplier'),reference:v.get('reference'),opening:v.has('opening')},false);const requestId=state.purchaseDraft.id;await dispatch({type:'POST_PURCHASE',requestId});const receipt=state.purchases.find(p=>p.requestId===requestId);closeModal();receiptDetail(receipt);toast('Stock received successfully');});}
  function checkout(){sheet('Complete bill',`<form id="checkout-form">${field('customer','Customer name (optional)',state.saleDraft.customer,'text','','maxlength="120"')}<label class="field"><span>Payment method</span><select name="payment">${['Cash','UPI','Card'].map(x=>`<option ${x===state.saleDraft.payment?'selected':''}>${x}</option>`).join('')}</select></label><div class="pricepanel"><small>Amount to collect · GST included</small><div class="money">${C.money(C.total(state))}</div></div><div class="note space">Confirm after receiving payment. This records the payment method; it does not process a payment.</div>${formFooter('Payment received · Complete bill')}</form>`);bindForm('checkout-form',async v=>{await dispatch({type:'SALE_META',customer:v.get('customer'),payment:v.get('payment')},false);const requestId=state.saleDraft.id;await dispatch({type:'COMPLETE_SALE',requestId});const invoice=state.sales.find(s=>s.requestId===requestId);closeModal();sheet('Bill completed',`<div class="success"><div class="successcheck">${icon('check')}</div><h2>Payment recorded</h2><p class="sub">${escape(invoice.number)} · ${escape(invoice.payment)}</p><div class="money">${C.money(invoice.total)}</div><p class="sub">Stock updated. Your bill is saved.</p></div>${action('pdf',`${icon('download')}Save PDF invoice`,'btn space',`data-id="${invoice.id}"`)}${action('close','Start next bill','btn secondary space')}`);});}
  function invoiceDetail(invoice){const returns=state.returns.filter(r=>r.saleId===invoice.id);sheet(invoice.number,`<div class="row between"><span class="muted">${new Date(invoice.time).toLocaleString('en-IN')}</span><span class="pill">${escape(invoice.payment)}</span></div><p class="sub">${escape(invoice.customer||'Walk-in customer')}</p><div class="card space">${invoice.lines.map(l=>`<div class="line"><span>${escape(l.name)} × ${l.qty}</span><strong>${C.money(l.qty*l.quote.selling)}</strong></div>`).join('')}<div class="line total"><span>Total collected</span><strong>${C.money(invoice.total)}</strong></div></div>${returns.map(r=>`<div class="returnitem">${r.qty} returned · ${C.money(r.refund)} refund · ${r.restock?'Restocked':'Quarantined'}<br>${escape(r.reason)}</div>`).join('')}${action('pdf',`${icon('download')}Save PDF invoice`,'btn space',`data-id="${invoice.id}"`)}${action('return',`${icon('return')}Scan a returned item`,'btn secondary space',`data-id="${invoice.id}"`)}<div class="note space">PDF exports use the original bill. Returns are saved separately and never rewrite it.</div>`);}
  function receiptDetail(r){sheet(r.number,`<p class="sub">${escape(r.supplier||'Stock receipt')} · ${friendlyDate(r.time)}</p>${r.opening?'<span class="pill">Opening balance</span>':''}${r.lines.map(l=>`<div class="batch"><h3>${escape(l.name)}</h3><div class="sub">${l.qty} units · Batch ${escape(l.batch)}</div><div class="line"><span>DP before GST</span><strong>${C.money(l.dp)}</strong></div><div class="line"><span>Batch MRP</span><strong>${C.money(l.mrp)}</strong></div>${action('lot-label',`${icon('download')}Save batch label`,'btn secondary space',`data-id="${l.lotId}"`)}</div>`).join('')}<div class="line total"><span>Total including GST</span><strong>${C.money(r.total)}</strong></div><div class="note space">Attach the internal label to identify batches when multiple batches of one product are in stock.</div>`);}
  function editLot(l){sheet('Correct batch MRP',`<form id="lot-form"><h3>Batch ${escape(l.batch)}</h3>${field('mrp','Printed batch MRP',amount(l.mrp),'text','','inputmode="decimal" required')}<div class="note">Purchase DP stays fixed at ${C.money(l.dp)}. This correction is recorded in the audit history.</div>${formFooter('Save corrected MRP')}</form>`);bindForm('lot-form',async v=>{await dispatch({type:'EDIT_LOT',id:l.id,dp:l.dp,gstBps:l.gstBps,mrp:C.cents(v.get('mrp'))});closeModal();toast('Batch MRP corrected');});}
  function settingsForm(pricing=false){
    const s=state.settings;
    if(pricing){
      sheet('Selling price plan',`<form id="settings-form"><label class="field"><span>Choose how new bills are priced</span><select name="pricingMode"><option value="dp" ${s.pricingMode==='dp'?'selected':''}>Original DP + GST · no extra markup</option><option value="markup" ${s.pricingMode==='markup'?'selected':''}>DP + GST + 10% markup</option><option value="margin" ${s.pricingMode==='margin'?'selected':''}>DP + GST with true 10% margin</option></select></label><div class="card space"><h3>Example: DP ₹100 · GST 18%</h3><div class="line"><span>Original DP + GST</span><strong>₹118.00</strong></div><div class="line"><span>10% markup</span><strong>₹129.80</strong></div><div class="line"><span>True 10% margin</span><strong>₹131.11</strong></div></div><div class="note space">This plan applies to future bill lines. GST is included in the shown selling price and is not added again at checkout. Every bill remains capped at its batch MRP.</div><div class="note space">Changing the plan does not rewrite completed invoices. Refresh an existing draft and review the total before checkout.</div>${formFooter('Save selling plan')}</form>`);
    }else{
      sheet('Store details',`<form id="settings-form">${field('storeName','Store name',s.storeName,'text','','maxlength="120" required')}${field('address','Address',s.address,'text','','maxlength="360"')}${field('phone','Phone',s.phone,'tel','','maxlength="40"')}${field('gstin','GSTIN (optional)',s.gstin,'text','','maxlength="30"')}<div class="note">These details appear on new bills. Existing bills keep their original store details.</div>${formFooter('Save store details')}</form>`);
    }
    bindForm('settings-form',async v=>{const prior=state.settings.pricingMode;await dispatch({type:'SAVE_SETTINGS',settings:{...state.settings,...Object.fromEntries(v.entries())}});const changed=pricing&&prior!==state.settings.pricingMode;if(changed&&state.saleDraft.lines.length)await dispatch({type:'REFRESH_PRICES'});closeModal();toast(changed&&state.saleDraft.lines.length?'Selling plan saved. Review the refreshed bill total.':'Settings saved');});
  }
  function returnForm(saleId,code){const sale=state.sales.find(x=>x.id===saleId),r=C.resolve(state,code);if(!sale||!r.product){toast('This return could not be matched to its original bill. No data was changed.');return;}const candidates=sale.lines.filter(l=>l.productId===r.product.id&&(!r.lot||l.lotId===r.lot.id));if(candidates.length!==1){toast('Scan the original batch barcode to identify this bill item.');return;}const l=candidates[0],returned=state.returns.filter(r=>r.saleId===saleId&&r.lineId===l.id).reduce((n,r)=>n+r.qty,0);sheet('Return item',`<h3>${escape(l.name)}</h3><p class="sub">${l.qty-returned} units remaining to return · ${C.money(l.quote.selling)} each</p><form id="return-form">${field('qty','Return quantity',1,'number','','min="1" required')}${field('reason','Reason','','text','','required maxlength="120"')}<label class="checkrow"><input type="checkbox" name="restock" checked>Item is unopened and saleable</label><div class="note">Expired or unsaleable items go to quarantine. Refunds use the original bill price.</div>${formFooter('Record return & refund')}</form>`);bindForm('return-form',async v=>{await dispatch({type:'RETURN',saleId,code,qty:Number(v.get('qty')),reason:v.get('reason'),restock:v.has('restock')});closeModal();toast('Return recorded');});}
  function adjustForm(code){const {product,lot}=C.adjustmentLot(state,code);sheet('Write off stock',`<h3>${escape(product.name)}</h3><p class="sub">Batch ${escape(lot.batch)} · ${lot.qty} available</p><form id="adjust-form">${field('qty','Units to remove from saleable stock',1,'number','','min="1" required')}${field('reason','Reason','','text','','required maxlength="120"')}<div class="note">This moves stock into quarantine and preserves the movement history.</div>${formFooter('Record stock write-off')}</form>`);bindForm('adjust-form',async v=>{await dispatch({type:'ADJUST',code,qty:Number(v.get('qty')),reason:v.get('reason')});closeModal();toast('Stock adjustment recorded');});}
  function reports(){const m=C.metrics(state);sheet('Reports · all time',`<div class="grid2"><div class="card"><small class="muted">Sales after returns</small><h2>${C.money(m.sales)}</h2></div><div class="card"><small class="muted">Gross profit</small><h2>${C.money(m.profit)}</h2></div></div><div class="card space"><div class="line"><span>Purchases including GST</span><strong>${C.money(m.purchases)}</strong></div><div class="line"><span>Stock value at DP</span><strong>${C.money(m.value)}</strong></div><div class="line"><span>Quarantined units</span><strong>${state.lots.reduce((n,l)=>n+l.quarantine,0)}</strong></div><div class="line"><span>Audit entries</span><strong>${state.audit.length}</strong></div></div><div class="sectionhead"><h2>Expiry alerts</h2></div>${m.expiring.length?m.expiring.map(l=>`<div class="batch"><h3>${escape(state.products.find(p=>p.id===l.productId).name)}</h3><div class="sub">Batch ${escape(l.batch)} · ${l.qty} units · ${escape(l.expiry)}</div></div>`).join(''):'<div class="note">No stock expires within the next 30 days.</div>'}<div class="note space">Gross profit excludes GST and uses historical purchase DP for units sold. Operating expenses and inventory write-downs are not deducted here.</div>`);}
  function download(name,content,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}
  function backup(){const payload=JSON.stringify(state);if(native)Android.exportBackup();else download(`Vestige-Backup-${C.day()}.json`,payload,'application/json');}
  function requestRestore(){if(native)Android.importBackup();else{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(input.files[0])restorePreview(await input.files[0].text());};input.click();}}
  function restorePreview(json){try{const restored=C.validateBackup(JSON.parse(json));sheet('Review backup',`<div class="card"><h3>${escape(restored.settings.storeName)}</h3><div class="line"><span>Products</span><strong>${restored.products.length}</strong></div><div class="line"><span>Completed bills</span><strong>${restored.sales.length}</strong></div><div class="line"><span>Stock batches</span><strong>${restored.lots.length}</strong></div></div><div class="note warn space">Restoring replaces this device’s store data. Export your current data first if you need to keep it.</div>${action('backup','Export current backup','btn secondary space')}<form id="restore-form">${field('confirm','Type RESTORE to continue','','text','','required autocomplete="off"')}${formFooter('Restore reviewed backup')}</form>`);bindForm('restore-form',async v=>{if(v.get('confirm')!=='RESTORE')throw new Error('Type RESTORE exactly.');await chain;restored.revision=state.revision+1;await repo.write(restored,state.revision);state=restored;navigate('home');toast('Backup restored');});}catch(e){toast(`Backup not restored: ${e.message}`);}}
  async function click(e){const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action;try{
    if(a==='close'){const back=modalBack;closeModal();back?.();}
    else if(a==='navigate')navigate(el.dataset.page);
    else if(a==='period'){period=el.dataset.value;render();}
    else if(a==='activity-tab'){activityTab=el.dataset.value;activityLimit=30;render();}
    else if(a==='more-activity'){activityLimit+=30;render();}
    else if(a==='more-products'){productLimit+=60;render();}
    else if(a==='more-catalogue'){catalogueLimit+=30;render();}
    else if(a==='scan')scan(el.dataset.mode);
    else if(a==='camera')launchCamera();
    else if(a==='catalog-link')scan('catalog-link',{barcode:el.dataset.code});
    else if(a==='link-catalog-pack')scan('link-product',{productId:el.dataset.id});
    else if(a==='catalog-help')catalogHelp();
    else if(a==='register')productForm(el.dataset.code);
    else if(a==='edit-product')productForm('',state.products.find(p=>p.id===el.dataset.id));
    else if(a==='quantity')await dispatch({type:'SET_SALE_QTY',id:el.dataset.id,qty:Number(el.dataset.qty)});
    else if(a==='remove-purchase')await dispatch({type:'REMOVE_PURCHASE_LINE',id:el.dataset.id});
    else if(a==='post-purchase')postPurchase();
    else if(a==='import-stock')requestStockImport();
    else if(a==='import-catalogue')requestCatalogueImport();
    else if(a==='stock-template')stockTemplate();
    else if(a==='confirm-stock-import'){
      if(!pendingStockImport?.length)throw new Error('There are no validated stock rows to import.');
      const lines=pendingStockImport;pendingStockImport=null;
      await dispatch({type:'IMPORT_PURCHASE_LINES',lines});closeModal();navigate('purchase');toast(`${lines.length} stock rows added to receipt`);
    }
    else if(a==='confirm-catalogue-import'){
      if(!pendingCatalogueImport?.length)throw new Error('There are no validated catalogue products to import.');
      const products=pendingCatalogueImport;pendingCatalogueImport=null;
      await dispatch({type:'IMPORT_CATALOGUE_PRODUCTS',products});closeModal();navigate('products');toast(`${products.length} catalogue products added at zero stock`);
    }
    else if(a==='checkout')checkout();
    else if(a==='clear-sale'||a==='clear-purchase'){sheet('Discard draft?',`<p class="muted">This only clears the unfinished ${a==='clear-sale'?'bill':'receipt'}. Stock will not change.</p>${action('confirm-clear','Discard draft','btn danger space',`data-type="${a==='clear-sale'?'CLEAR_SALE':'CLEAR_PURCHASE'}"`)}`);}
    else if(a==='confirm-clear'){await dispatch({type:el.dataset.type});closeModal();}
    else if(a==='refresh-prices'){await dispatch({type:'REFRESH_PRICES'});toast('Prices refreshed. Review your bill total.');}
    else if(a==='invoice')invoiceDetail(state.sales.find(s=>s.id===el.dataset.id));
    else if(a==='receipt')receiptDetail(state.purchases.find(s=>s.id===el.dataset.id));
    else if(a==='pdf'){if(native)Android.exportInvoice(el.dataset.id);else toast('PDF export uses Android’s document saver. Build and install the app to export.');}
    else if(a==='lot-label'){if(native)Android.exportLotLabel(el.dataset.id);else toast('Batch label PDF export is available in the Android app.');}
    else if(a==='edit-lot')editLot(state.lots.find(l=>l.id===el.dataset.id));
    else if(a==='store-settings')settingsForm();
    else if(a==='pricing-settings')settingsForm(true);
    else if(a==='reports')reports();
    else if(a==='backup')backup();
    else if(a==='restore')requestRestore();
    else if(a==='return')scan('return',{saleId:el.dataset.id});
    else if(a==='adjust')scan('adjust');
  }catch(err){toast(err.message);}}
  document.addEventListener('click',click);
  document.addEventListener('input',e=>{
    if(e.target.id!=='product-search'||page!=='products')return;
    productQuery=e.target.value;productLimit=60;catalogueLimit=30;refreshProductResults();
  });
  document.addEventListener('change',e=>{
    if(page!=='products')return;
    if(e.target.id==='product-category')productCategory=e.target.value;
    else if(e.target.id==='product-stock')productStock=e.target.value;
    else return;
    productLimit=60;catalogueLimit=30;refreshProductResults();
  });
  let buffer='',lastKey=0;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeModal();return;}
    if(e.key==='Tab'&&document.querySelector('.sheet')){const nodes=[...document.querySelectorAll('.sheet button,.sheet input,.sheet select,.sheet textarea')].filter(x=>!x.disabled);if(nodes.length){if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}}
    if(!pendingMode||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(Date.now()-lastKey>600)buffer='';lastKey=Date.now();
    if(e.key==='Enter'&&buffer){e.preventDefault();const code=buffer;buffer='';onScan(code,pendingMode);}
    else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(buffer.length<160)buffer+=e.key;}
  });
  window.addEventListener('error',()=>{if(state)toast('Something went wrong. Your last saved data is preserved.');});
  async function init(){try{await repo.open();const saved=await repo.read();if(saved){state=C.validateBackup(saved);}else{state=C.fresh();await repo.write(state,-1);}render();if(native)Android.ready();}catch(e){document.getElementById('app').innerHTML=`<div class="shell"><div class="content"><div class="pagehead"><h1>Could not open your store</h1><p>Your existing data has not been overwritten.</p></div><div class="note bad">${escape(e.message)}</div><p class="sub space">Close and reopen the app. If the problem continues, keep the app installed so your data can be recovered.</p></div></div>`;}}
  // Test hooks are only exposed to the local preview server, never the Android origin.
  if(!native&&['127.0.0.1','localhost'].includes(location.hostname)){window.PreviewTools={async scan(code,mode,extra={}){await onScan(code,{mode,...extra});},state:()=>C.clone(state),async use(data){preview=true;state=C.validateBackup(data);render();},navigate};}
  init();
})();
