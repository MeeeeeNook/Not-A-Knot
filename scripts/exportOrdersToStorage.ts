import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true
}, cfg.firestoreDatabaseId);
const storage = getStorage(app);

async function exportOrdersToStorage() {
  console.log('Fetching orders from Firestore...');
  const snap = await getDocs(collection(db, 'orders'));
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('Total orders found in Firestore:', orders.length);

  // 1. Save full orders backup file to orders/orders_backup.json
  const jsonContent = JSON.stringify(orders, null, 2);
  const jsonRef = ref(storage, 'orders/orders_backup.json');
  await uploadString(jsonRef, jsonContent, 'raw', { contentType: 'application/json' });
  const jsonUrl = await getDownloadURL(jsonRef);
  console.log('Uploaded master orders file to Storage:', jsonUrl);

  // 2. Save individual JSON files per order into orders/details/
  for (const ord of orders) {
    const ordRef = ref(storage, `orders/details/${ord.id}.json`);
    await uploadString(ordRef, JSON.stringify(ord, null, 2), 'raw', { contentType: 'application/json' });
  }
  console.log('Uploaded all individual order JSON files to Storage orders/details/');
  process.exit(0);
}

exportOrdersToStorage().catch((err) => {
  console.error('EXPORT FAILED:', err);
  process.exit(1);
});
