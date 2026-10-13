import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommissionQrRequest } from '../src/utils/affiliatePayment.ts';
import { getAffiliateCommissionPayments, setOrderCommissionPaid } from '../src/utils/affiliateCommissionPayments.ts';
import type { SellerUser, StoredOrder } from '../src/types.ts';

const affiliate = { id: 'aff', username: 'test', affiliateCode: 'TEST', commissionRate: 10 } as SellerUser;
const order = (id: string, amount: number, extra = {}) => ({ id, affiliateCode: 'TEST', affiliateCommissionAmount: amount, status: 'Chờ xác nhận', ...extra } as StoredOrder);
const account = { bankBin: '970422', bankCode: 'MB', bankName: 'MBBank', accountNumber: '00123456789', accountName: 'NGUYEN VAN A' };

test('marking an order paid is idempotent, stores a snapshot, and uncheck restores availability', () => {
 const original = order('one', 10000), paid = setOrderCommissionPaid(original, affiliate, true, 'Admin');
 assert.equal(paid.affiliateCommissionPaidAmount,10000); assert.ok(paid.affiliateCommissionPaidAt); assert.equal(paid.affiliateCommissionPaidBy,'Admin');
 assert.equal(setOrderCommissionPaid(paid,affiliate,true,'Another admin'),paid);
 assert.deepEqual(getAffiliateCommissionPayments(affiliate,[paid,order('two',20000)]),{earned:30000,paid:10000,available:20000,paidOrders:1});
 const unpaid=setOrderCommissionPaid(paid,affiliate,false,'Admin');
 assert.equal(unpaid.affiliateCommissionPaidAmount,0);assert.equal(unpaid.affiliateCommissionPaidAt,'');assert.equal(getAffiliateCommissionPayments(affiliate,[unpaid]).available,10000);
 assert.equal(original.affiliateCommissionPaid,undefined);
});
test('cancelled/deleted earnings are excluded while previous payments remain in the ledger',()=>{
 const paid=setOrderCommissionPaid(order('one',10000),affiliate,true,'Admin');
 const result=getAffiliateCommissionPayments(affiliate,[{...paid,status:'Đã hủy'},order('deleted',30000,{isDeleted:true}),order('valid',5000),order('other',90000,{affiliateCode:'OTHER'})]);
 assert.deepEqual(result,{earned:5000,paid:10000,available:0,paidOrders:1});
 assert.throws(()=>setOrderCommissionPaid(order('cancelled',1000,{status:'Đã hủy'}),affiliate,true,'Admin'));
 assert.throws(()=>setOrderCommissionPaid(order('other',1000,{affiliateCode:'OTHER'}),affiliate,true,'Admin'));
});
test('payment snapshot survives commission changes and zero commission stays zero',()=>{
 const paid=setOrderCommissionPaid(order('one',10000),affiliate,true,'Admin');
 assert.equal(getAffiliateCommissionPayments(affiliate,[{...paid,affiliateCommissionAmount:15000}]).available,5000);
 assert.equal(getAffiliateCommissionPayments(affiliate,[order('zero',0)]).earned,0);
});
test('VietQR uses the receiving bank/account/amount and rejects amounts outside the remaining balance',()=>{
 const request=createCommissionQrRequest(account,20000,20000,'TEST'); const url=new URL(request.url);
 assert.equal(url.host,'img.vietqr.io');assert.ok(url.pathname.includes('970422-00123456789'));assert.equal(url.searchParams.get('amount'),'20000');assert.equal(url.searchParams.get('accountName'),'NGUYEN VAN A');
 assert.equal(url.searchParams.get('addInfo'),'NAK HOA HONG TEST');
 for(const amount of [0,-1,20001,1.5,NaN])assert.throws(()=>createCommissionQrRequest(account,amount,20000,'TEST'));
 assert.throws(()=>createCommissionQrRequest({...account,accountName:''},1,20000,'TEST'));
 assert.throws(()=>createCommissionQrRequest({...account,bankBin:''},1,20000,'TEST'));
});
