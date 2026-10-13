const fs=require('fs'),path=require('path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {createRequire}=require('node:module');
const {doc,setDoc,updateDoc}=createRequire(require.resolve('@firebase/rules-unit-testing'))('firebase/firestore');
(async()=>{
 const rules=fs.readFileSync(path.resolve(__dirname,'../firestore.rules'),'utf8');
 const rootEmail=[...rules.matchAll(/userEmail\(\) == '([^']+)'/g)][0][1];
 const env=await initializeTestEnvironment({projectId:'demo-notaknot',firestore:{rules,host:(process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8185').split(':')[0],port:Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8185').split(':')[1])}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'authorized_sellers','staff@example.com'),{role:'member',isActive:true});
   await setDoc(doc(db,'authorized_sellers','affiliate@example.com'),{role:'affiliate',isActive:true});
   await setDoc(doc(db,'authorized_sellers','blocked@example.com'),{role:'member',isActive:false});
   await setDoc(doc(db,'orders','existing'),{name:'Test',phone:'123456789',status:'Chờ xác nhận',paymentStatus:'unpaid',affiliateCode:'QA',affiliateCommissionAmount:10000});
  });
  const ctx=(id,email,verified=true)=>env.authenticatedContext(id,{email,email_verified:verified});
  const paid={affiliateCommissionPaid:true,affiliateCommissionPaidAmount:10000,affiliateCommissionPaidAt:new Date().toISOString(),affiliateCommissionPaidBy:'Staff QA'};
  await assertSucceeds(updateDoc(doc(ctx('staff','staff@example.com').firestore(),'orders','existing'),paid));
  await assertSucceeds(updateDoc(doc(ctx('root',rootEmail).firestore(),'orders','existing'),{...paid,affiliateCommissionPaid:false,affiliateCommissionPaidAmount:0,affiliateCommissionPaidAt:'',affiliateCommissionPaidBy:''}));
  await assertFails(updateDoc(doc(ctx('affiliate','affiliate@example.com').firestore(),'orders','existing'),paid));
  await assertFails(updateDoc(doc(ctx('blocked','blocked@example.com').firestore(),'orders','existing'),paid));
  await assertFails(updateDoc(doc(ctx('unknown','unknown@example.com').firestore(),'orders','existing'),paid));
  await assertFails(updateDoc(doc(ctx('unverified','staff@example.com',false).firestore(),'orders','existing'),paid));
  await assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(),'orders','existing'),paid));
  const publicOrder={name:'A',phone:'123456789',status:'Chờ xác nhận',paymentStatus:'unpaid'};
  await assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(),'orders','public-normal'),publicOrder));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'orders','public-forged'),{...publicOrder,...paid}));
  await assertFails(setDoc(doc(ctx('affiliate','affiliate@example.com').firestore(),'orders','affiliate-forged'),{...publicOrder,...paid}));
  // Existing approved-affiliate access to unrelated fields is intentionally unchanged.
  await assertSucceeds(updateDoc(doc(ctx('affiliate','affiliate@example.com').firestore(),'orders','existing'),{note:'fixture only'}));
  console.log('PASS: approved verified staff/root can record payouts; affiliate/unknown/blocked/unverified/anonymous cannot; public checkout creation stays unchanged; no live Firebase writes.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exit(1)});
