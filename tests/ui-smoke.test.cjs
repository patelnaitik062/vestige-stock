// Executes packaged UI event handlers against a small mocked Android bridge.
// This is not browser rendering, camera verification, or Android integration.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../app/src/main/assets/core.js');
const K=require('../app/src/main/assets/catalogue.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'../app/src/main/assets/app.js'),'utf8');
function seeded(){let s=C.fresh();s=C.apply(s,{type:'SAVE_PRODUCT',product:{barcode:'00123',name:'UI Test Product',pack:'100 ml',dp:10000,mrp:16000,gstBps:1800,expiryRequired:false,active:true}});s=C.apply(s,{type:'PURCHASE_LINE',line:{productId:s.products[0].id,qty:5,dp:10000,mrp:16000,gstBps:1800,batch:'TEST',expiry:''}});return C.apply(s,{type:'POST_PURCHASE',requestId:s.purchaseDraft.id});}
async function app(initial){
 const elements=new Map(),listeners={},body={style:{}};let saved=initial,ready=false,writes=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},children:[],classList:{add(){},remove(){}},addEventListener(){}});return elements.get(id);};
 const bridge={loadState:()=>JSON.stringify({state:saved}),saveState:(json,expected)=>{if((saved?.revision??-1)!==expected)return JSON.stringify({error:'Revision conflict'});saved=JSON.parse(json);writes++;return '{"ok":true}';},ready:()=>ready=true};
 const win={StockCore:C,VestigeCatalog:K,Android:bridge,addEventListener(){},scrollTo(){}};
 const context={window:win,Android:bridge,document:{body,getElementById:element,querySelector:()=>null,addEventListener:(event,fn)=>listeners[event]=fn},location:{hostname:'appassets.androidplatform.net'},console,setTimeout:()=>1,clearTimeout(){},Date,Intl,Promise};
 vm.runInNewContext(code,context);await new Promise(setImmediate);
 return {html:()=>element('app').innerHTML,modal:()=>element('overlay').innerHTML,ready:()=>ready,state:()=>saved,writes:()=>writes,
  click:async(action,data={})=>{await listeners.click({target:{closest:()=>({disabled:false,dataset:{action,...data}})}});},
  scan:(code,mode,extra={})=>win.onNativeEvent({type:'scan',code,context:JSON.stringify({mode,...extra})})};
}
test('packaged UI boots through native bridge and renders an empty dashboard',async()=>{const a=await app(null);assert(a.ready());assert.match(a.html(),/Business overview/);assert.match(a.html(),/Your first scan/);assert.equal(a.state().products.length,0);});
test('all navigation pages render from real persisted domain state',async()=>{const a=await app(seeded());for(const [page,title] of [['products','Products'],['billing','New bill'],['purchase','Receive stock'],['activity','Activity'],['more','Your store'],['home','Business overview']]){await a.click('navigate',{page});assert.match(a.html(),new RegExp(title));}});
test('camera result routed to price check does not write data',async()=>{const a=await app(seeded()),writes=a.writes();await a.scan('00123','price');assert.match(a.modal(),/129.80/);assert.equal(a.writes(),writes);assert.equal(a.state().lots[0].qty,5);});
test('camera result routed to billing persists draft quantities and preserves on-hand stock',async()=>{const a=await app(seeded());await a.scan('00123','bill');await a.scan('00123','bill');assert.equal(a.state().saleDraft.lines[0].qty,2);assert.equal(a.state().lots[0].qty,5);assert.match(a.html(),/259.60/);});
test('unknown scan shows registration without creating free-price products',async()=>{const a=await app(seeded()),writes=a.writes();await a.scan('UNKNOWN','bill');assert.match(a.modal(),/Product not registered/);assert.equal(a.writes(),writes);assert.equal(a.state().products.length,1);});

test('preloaded catalogue is visible at zero stock without rewriting a saved store',async()=>{const original=seeded(),a=await app(original);await a.click('navigate',{page:'products'});assert.match(a.html(),/253 official product listings/);assert.match(a.html(),/0 in stock/);assert.match(a.html(),/Reference MRP/);assert.equal(a.writes(),0);assert.deepEqual(a.state(),original);});
test('catalogue setup requires a real pack first and does not create products from setup QR codes',async()=>{const a=await app(seeded()),before=a.state();await a.scan('VSCAT:Y20025','bill');assert.deepEqual(a.state(),before);assert.equal(a.writes(),0);await a.scan('VSCAT:Y20025','catalog-link',{barcode:'TEST-PACK-ONLY'});assert.match(a.modal(),/Vestige Amla 60 Capsules/);assert.match(a.modal(),/name="barcode"[^>]*value="TEST-PACK-ONLY"/);assert.match(a.modal(),/name="dp"[^>]*value=""/);assert.match(a.modal(),/name="gst"[^>]*value=""/);assert.equal(a.writes(),0);});
