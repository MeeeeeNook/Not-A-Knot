const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { createRequire } = require('node:module');
let handler;
let affiliateHandler;
let nextId = 0;
let fixture;
const firestore = `
export const getFirestore=()=>({}); export const doc=(_,collection,id)=>({collection,id});
export const collection=(_,name)=>({collection:name}); export const where=(field,op,value)=>({field,value}); export const limit=()=>({}); export const query=(ref,...filters)=>({...ref,filters});
export const getDoc=async(ref)=>{const f=globalThis.__orderFixture;if(ref.collection==='system_settings'){if(f.policyError)throw Error('policy unavailable');return {exists:()=>true,data:()=>({limits:f.limits})};}const data=ref.collection==='products'?f.products[ref.id]:null;return {id:ref.id,exists:()=>!!data,data:()=>data};};
export const getDocs=async(ref)=>{const f=globalThis.__orderFixture;const filter=ref.filters?.find(x=>x.value);const data=ref.collection==='vouchers'?f.vouchers.find(x=>x.code===filter?.value):ref.collection==='sellers'?f.affiliate:null;return {empty:!data,docs:data?[{id:data.id||'db-voucher-id',data:()=>data,ref:{}}]:[]};};
export const setDoc=async(ref,data)=>globalThis.__orderFixture.writes.push({ref,data}); export const updateDoc=async()=>{};export const increment=(n)=>n;
`;
test.before(async()=>{
  const result=await esbuild.build({entryPoints:['server/orderApi.ts','server/affiliateApi.ts'],outdir:'fixture-bundles',bundle:true,write:false,format:'cjs',platform:'node',packages:'external',logLevel:'silent',plugins:[{name:'fixtures',setup(build){
    build.onResolve({filter:/^(firebase|firebase-admin)\//},args=>({path:args.path,namespace:'fixtures'}));
    build.onResolve({filter:/(voucherManager|data\/products|orders\/track)\.ts$/},args=>({path:args.path,namespace:'fixtures'}));
    build.onResolve({filter:/^\.\/track\.ts$/},args=>({path:'orders/track.ts',namespace:'fixtures'}));
    build.onLoad({filter:/.*/,namespace:'fixtures'},args=>({loader:'js',contents:
      args.path==='firebase/firestore'?firestore:
      args.path.includes('voucherManager')?'export const DEFAULT_INITIAL_VOUCHERS=[];':
      args.path.includes('products')?'export const PRODUCTS=[];':
      args.path.includes('track')?'export const normalizeVietnamesePhone=x=>x;export const isValidVietnamesePhone=()=>true;':
      args.path==='firebase/app'?'export const initializeApp=()=>({});export const getApps=()=>[];export const getApp=()=>({});':
      args.path==='firebase/auth'?'export const getAuth=()=>({});export const signInWithEmailAndPassword=async()=>{};':
      args.path==='firebase-admin/app'?'export const initializeApp=()=>({});export const getApps=()=>[];export const cert=()=>({});':
      args.path==='firebase-admin/firestore'?'export const getFirestore=()=>({});export const FieldValue={increment:x=>x};':
      args.path==='firebase-admin/auth'?'export const getAuth=()=>({});':'export const getStorage=()=>({});'
    }));
  }}]});
  for (const output of result.outputFiles) {
    const mod={exports:{}}; new Function('require','module','exports',output.text)(createRequire(__filename),mod,mod.exports);
    if (output.path.endsWith('/affiliateApi.js')) affiliateHandler=mod.exports.default; else handler=mod.exports.default;
  }
});
test.beforeEach(()=>{
  delete process.env.FIREBASE_CLIENT_EMAIL; delete process.env.FIREBASE_PRIVATE_KEY; delete process.env.TRACKER_SERVICE_PASSWORD;
  fixture=globalThis.__orderFixture={limits:{},products:{p:{name:'Product',price:100000,maxPercentVouchers:99}},vouchers:[{id:'a',code:'A',type:'percent',discountPercent:10,isActive:true},{id:'b',code:'B',type:'percent',discountPercent:10,isActive:true},{id:'ship',code:'SHIP',type:'freeship',isActive:true},{id:'ship2',code:'SHIP2',type:'freeship',isActive:true}],writes:[],affiliate:null};
});
async function request(codes=[],extra={}){
  const id=++nextId;const req={method:'POST',headers:{'x-real-ip':`fixture-${id}`},body:{customerName:'Test User',phone:'0912345678',province:'Hà Nội',district:'Hai Bà Trưng',detailedAddress:'Test address',clientOrderId:`NAK-TEST-${id}`,items:[{productId:'p',price:1,quantity:1,maxPercentVouchers:99}],voucherCodes:codes,...extra}};
  const res={code:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.data=v;return this;},end(){return this;}};await handler(req,res);return res;
}
test('API ignores shopper and mutable product limits; default rejects a second percent code',async()=>{const res=await request(['A','B']);assert.equal(res.code,400);assert.equal(fixture.writes.length,0);});
test('API uses protected limit 2, authoritative prices, sequential discounts and one freeship',async()=>{fixture.limits.p=2;const res=await request(['A','B','SHIP']);assert.equal(res.code,200);assert.equal(res.data.order.subtotal,100000);assert.equal(res.data.order.discountAmount,19000);assert.equal(res.data.totalPrice,81000);assert.equal(res.data.order.itemDetails[0].productId,'p');});
test('protected zero disables percentages but preserves freeship',async()=>{fixture.limits.p=0;assert.equal((await request(['A'])).code,400);assert.equal((await request(['SHIP'])).code,200);});
test('API rejects duplicate freeship and honours document IDs in product allowlists',async()=>{assert.equal((await request(['SHIP','SHIP2'])).code,400);fixture.products.p.applyAllVouchers=false;fixture.products.p.applicableVoucherIds=['a'];assert.equal((await request(['A'])).code,200);assert.equal((await request(['B'])).code,400);});
test('unknown policy fails closed; orders without percent codes need no policy read',async()=>{fixture.policyError=true;assert.equal((await request(['A'])).code,500);assert.equal(fixture.writes.length,0);assert.equal((await request([])).code,200);});
test('unlimited affiliate policy survives three successive orders; exhausted limited sessions get no commission',async()=>{
 fixture.affiliate={id:'aff',affiliateCode:'AFF',name:'Partner',isActive:true,commissionRate:10,maxOrdersPerCookieSession:0};
 for(let i=0;i<3;i++){const res=await request([],{affiliateCode:'AFF'});assert.equal(res.data.affiliateAttributed,true);assert.deepEqual(res.data.affiliatePolicy,{code:'AFF',maxOrders:0});assert.equal(res.headers['Set-Cookie'],undefined);}
 fixture.affiliate.maxOrdersPerCookieSession=1;
 const session=encodeURIComponent(JSON.stringify({code:'AFF',expiresAt:new Date(Date.now()+86400000).toISOString(),orderCount:1}));
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.data=v;return this;}};
 await handler({method:'POST',headers:{cookie:`nak_affiliate_ref=${session}`,'x-real-ip':'fixture-exhausted'},body:{customerName:'Test User',phone:'0912345678',province:'Hà Nội',district:'Hai Bà Trưng',detailedAddress:'Test address',items:[{productId:'p',quantity:1}],affiliateCode:'AFF'}},res);
 assert.equal(res.code,200);assert.equal(res.data.affiliateAttributed,false);assert.equal(res.data.order.affiliateCode,undefined);
});

test('public referral lookup preserves unlimited settings without exposing private seller data', async()=>{
 fixture.affiliate={id:'aff',affiliateCode:'AFF',name:'Partner',isActive:true,commissionRate:0,maxOrdersPerCookieSession:0,cookieDurationDays:60,googleEmail:'private@example.com',paymentInfo:'private bank'};
 const res={setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}};
 await affiliateHandler({method:'GET',query:{code:'AFF'}},res);
 assert.equal(res.code,200);assert.equal(res.data.affiliate.maxOrdersPerCookieSession,0);assert.equal(res.data.affiliate.commissionRate,0);assert.equal(res.data.affiliate.cookieDurationDays,60);
 assert.equal(res.data.affiliate.googleEmail,undefined);assert.equal(res.data.affiliate.paymentInfo,undefined);
 fixture.affiliate.isActive=false;await affiliateHandler({method:'GET',query:{code:'AFF'}},res);assert.equal(res.code,404);
});
