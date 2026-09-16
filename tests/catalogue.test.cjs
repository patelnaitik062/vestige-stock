const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js'),K=require('../app/src/main/assets/catalogue.js');
const source=require('../catalogue/vestige-india-2026-09-16.json');
const item=K.lookup('VSCAT:Y20025');
test('bundled catalogue matches verified source facts and excludes zero-MRP package placeholders',()=>{
 assert.equal(K.items.length,253);assert.deepEqual(K.items,source.products);assert.equal(new Set(K.items.map(p=>p.code)).size,253);
 for(const p of K.items){assert(p.referenceMrp>0&&p.name&&p.pack);assert.equal(new URL(p.sourceUrl).hostname,'www.myvestige.com');assert.equal(p.dp,undefined);assert.equal(p.barcode,undefined);assert.equal(p.gstBps,undefined);}
 assert.equal(K.lookup('VSCAT:MCI150'),null);
});
test('website item codes never automatically resolve as physical product barcodes',()=>{
 const s=C.fresh();assert.equal(K.lookup('Y20025'),null);assert.equal(K.lookup('8900000000000'),null);assert.equal(C.resolve(s,'Y20025').product,undefined);
 assert.throws(()=>C.apply(s,{type:'SCAN_SALE',code:'VSCAT:Y20025'}),/not registered/);
});
test('unknown prices stay unset and registration cannot produce a free-price sale',()=>{
 const s=C.fresh(),preset=K.prefill(item,'TEST-REAL-PACK');assert.equal(preset.dp,0);assert.equal(preset.gstBps,null);
 assert.throws(()=>C.apply(s,{type:'SAVE_PRODUCT',product:preset}),/greater than zero/);
 assert.throws(()=>C.apply(s,{type:'SAVE_PRODUCT',product:{...preset,dp:10000}}),/GST/);
 assert.throws(()=>K.prefill(item,'VSCAT:Y20025'),/physical pack/);
});
test('confirming a catalogue product saves the actual barcode with exactly zero stock and no purchases',()=>{
 const original=C.fresh(),preset=K.prefill(item,'TEST-REAL-PACK'),s=C.apply(original,{type:'SAVE_PRODUCT',product:{...preset,dp:10000,gstBps:1800}}),p=s.products[0];
 assert.equal(C.stock(s,p.id),0);assert.equal(C.metrics(s).units,0);assert.equal(C.metrics(s).purchases,0);assert.equal(s.lots.length,0);assert.equal(s.movements.length,0);
 assert.equal(C.resolve(s,'TEST-REAL-PACK').product.id,p.id);assert.equal(K.pending(s).length,252);assert.equal(K.pending(original).length,253);
 assert.throws(()=>C.apply(s,{type:'SCAN_SALE',code:p.barcode}),/No saleable stock/);
 assert.deepEqual(C.validateBackup(s),s);
});
test('duplicate catalogue links and using catalogue QR as a pack are rejected atomically',()=>{
 const product={...K.prefill(item,'TEST-A'),dp:10000,gstBps:1800},s=C.apply(C.fresh(),{type:'SAVE_PRODUCT',product}),before=C.clone(s);
 assert.throws(()=>C.apply(s,{type:'SAVE_PRODUCT',product:{...product,barcode:'TEST-B'}}),/already linked/);
 assert.deepEqual(s,before);
 assert.throws(()=>C.apply(s,{type:'SAVE_PRODUCT',product:{...product,barcode:'VSCAT:Y20025'}}),/physical pack/);
 const bad=C.clone(s);bad.products.push({...bad.products[0],id:'other-id',barcode:'TEST-B'});assert.throws(()=>C.validateBackup(bad),/Duplicate catalogue/);
});
test('adding catalogue link to an existing product preserves its purchase ledger and prices',()=>{
 let s=C.apply(C.fresh(),{type:'SAVE_PRODUCT',product:{barcode:'EXISTING-PACK',name:'My saved Amla',pack:'60 capsules',dp:11000,mrp:29000,gstBps:500,active:true}});
 s=C.apply(s,{type:'PURCHASE_LINE',line:{productId:s.products[0].id,qty:4,dp:10000,mrp:29000,gstBps:500,batch:'OLD',expiry:''}});s=C.apply(s,{type:'POST_PURCHASE',requestId:s.purchaseDraft.id});
 const before=C.clone(s);s=C.apply(s,{type:'SAVE_PRODUCT',product:{...s.products[0],catalogCode:item.code}});
 for(const key of ['lots','purchases','sales','returns','movements','saleDraft','purchaseDraft'])assert.deepEqual(s[key],before[key]);
 assert.equal(s.products[0].name,'My saved Amla');assert.equal(s.products[0].dp,11000);assert.equal(C.stock(s,s.products[0].id),4);assert.deepEqual(C.validateBackup(before),before);
});
