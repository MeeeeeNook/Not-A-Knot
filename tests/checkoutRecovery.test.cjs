const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the production handlers with isolated browser/Firestore dependencies.
// No orders are sent to the live database.
function loadHandler(path, name, context) {
  const file = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) initializer = node.initializer.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(initializer, `Missing production handler ${name}`);
  const source = ts.transpileModule(`const ${name} = ${initializer}; globalThis.${name} = ${name};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(source, context);
  return context[name];
}

function fixture(result) {
  const writes = [], steps = [], errors = [], placed = [], timers = [];
  const cache = new Map();
  const items = [{ product: { id: 'p', name: 'Product', price: 100000 }, quantity: 1 }];
  const context = vm.createContext({
    console: { warn() {}, error() {} },
    require: (path) => path.includes('orderService') ? { submitOrderToServer: async () => result } : { uploadOrderCustomPhotosToStorage: async (_, details) => details },
    canonicalOrderKey: (value) => value?.toUpperCase(),
    uploadOrderCustomPhotosToStorage: async (_, details) => details,
    auth: { currentUser: null }, db: {}, storage: {}, ordersMemoryCache: null,
    doc: (_, collection, id) => ({ collection, id }),
    setDoc: async (ref, data) => writes.push({ ref, data }),
    sanitizeItemDetailsForFirestore: (value) => value, cleanFirestoreData: (value) => value,
    formatOrderDateWithoutSeconds: String, safeIsoDateString: String,
    localStorage: { getItem: (key) => cache.get(key) || null, setItem: (key, value) => cache.set(key, value) },
    safeStorageSetItem: (key, value) => cache.set(key, value), dispatchSafeEvent() {}, recordOperation() {},
    ref: (_, path) => path, uploadString: async () => {}, isQuotaExhaustedError: () => false,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    name: 'A', phone: '123456789', province: 'Hà Nội', district: 'Hai Bà Trưng', detailedAddress: '1',
    customerEmail: '', note: '', paymentMethod: 'cod', cartItems: items, availableCartItems: items,
    hasUnavailableItems: false, grandTotal: 100000, effectiveShippingFee: 0,
    selectedVouchers: [], voucherDiscountAmount: 0,
    setFormError: (value) => errors.push(value), setPriceChangeWarning() {}, setIsSubmitting() {},
    setSubmissionStep: (value) => steps.push(value), setSubmissionError: (value) => errors.push(value),
    generateTrackingNumber: () => 'NAK-RECOVERY', formatCartItemsText: () => ['Product (x1) - 100.000đ'],
    getActiveAffiliateReferral: () => null, getAdminSession: () => null,
    submitOrderToServer: async () => result, sendOrderConfirmationEmail: async () => {},
    setPlacedOrder() {}, setPlacedTotal() {}, onOrderPlaced: (order) => placed.push(order), trackGA4Purchase() {},
    setStep() {}, onClearCart() {}, window: { scrollTo() {} }
  });
  loadHandler('src/firebase.ts', 'saveOrderToFirestore', context);
  const submit = loadHandler('src/components/CartPage.tsx', 'handleCheckoutSubmit', context);
  return { context, submit, writes, steps, errors, placed };
}

for (const error of ['Số điện thoại không hợp lệ.', 'Dữ liệu sản phẩm thứ 1 không hợp lệ.', 'Máy chủ phản hồi không đúng định dạng (500).']) {
  test(`checkout restores direct persistence after API error: ${error}`, async () => {
    const f = fixture({ success: false, error });
    await f.submit();
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].ref.collection, 'orders');
    assert.equal(f.writes[0].data.phone, '123456789');
    assert.equal(f.writes[0].data.itemDetails[0].productId, 'p');
    assert.equal(f.placed.length, 1);
    assert.ok(f.steps.includes('confirmed'));
    assert.ok(!f.steps.includes('error'));
  });
}

test('checkout still asks for price confirmation without writing an order', async () => {
  const f = fixture({ success: false, requiresConfirmation: true, newTotal: 110000 });
  await f.submit();
  assert.equal(f.writes.length, 0);
  assert.equal(f.placed.length, 0);
  assert.equal(f.steps.at(-1), 'idle');
});

test('existing required fields and minimum phone length remain enforced by the form', async () => {
  for (const [field, value] of [['phone', '12345678'], ['name', ''], ['detailedAddress', '']]) {
    const f = fixture({ success: false, error: 'unavailable' });
    f.context[field] = value;
    await f.submit();
    assert.equal(f.writes.length, 0);
    assert.ok(f.errors.some(Boolean));
  }
});
