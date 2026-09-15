import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true
}, cfg.firestoreDatabaseId);
const storage = getStorage(app);

const inMemoryAssetCache = new Map<string, string>();

async function resolveAsset(val?: string): Promise<string | undefined> {
  if (!val || typeof val !== 'string') return val;
  if (val.startsWith('http://') || val.startsWith('https://')) return val;
  if (val.startsWith('data:image/')) return val;
  if (val.startsWith('asset:')) {
    const assetId = val.replace('asset:', '');
    if (inMemoryAssetCache.has(assetId)) return inMemoryAssetCache.get(assetId);

    // Fetch asset doc
    const snap = await getDoc(doc(db, 'product_assets', assetId));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.isChunked && data.totalChunks > 0) {
        const chunkSnaps = await Promise.all(
          Array.from({ length: data.totalChunks }, (_, c) => getDoc(doc(db, 'product_asset_chunks', `${assetId}_chk_${c}`)))
        );
        const assembled = chunkSnaps.map((s) => (s.exists() ? s.data()?.data || '' : '')).join('');
        if (assembled) {
          inMemoryAssetCache.set(assetId, assembled);
          return assembled;
        }
      } else if (data?.data) {
        inMemoryAssetCache.set(assetId, data.data);
        return data.data;
      }
    }
  }
  return val;
}

async function uploadToStorage(base64OrToken?: string, storagePath?: string): Promise<string | undefined> {
  if (!base64OrToken || !storagePath) return base64OrToken;
  const resolved = await resolveAsset(base64OrToken);
  if (!resolved || typeof resolved !== 'string') return resolved;
  if (resolved.startsWith('http://') || resolved.startsWith('https://')) return resolved;
  if (resolved.startsWith('data:image/') || resolved.length > 300) {
    try {
      const storageRef = ref(storage, storagePath);
      let payload = resolved;
      if (!payload.startsWith('data:')) {
        payload = `data:image/png;base64,${payload}`;
      }
      await uploadString(storageRef, payload, 'data_url');
      const url = await getDownloadURL(storageRef);
      console.log(' -> Uploaded to Storage:', storagePath, '=>', url.slice(0, 60) + '...');
      return url;
    } catch (err: any) {
      console.error('Failed uploadToStorage for', storagePath, err?.message);
      return resolved;
    }
  }
  return resolved;
}

async function migrateAllProducts() {
  console.log('Starting migration of all products to Firebase Storage...');
  const snap = await getDocs(collection(db, 'products'));
  console.log('Found', snap.size, 'products in Firestore');

  for (const docSnap of snap.docs) {
    const prod = { id: docSnap.id, ...docSnap.data() } as any;
    console.log('\n--- Processing product:', prod.id, prod.name);

    // 1. Main image
    if (prod.image) {
      prod.image = (await uploadToStorage(prod.image, `products/${prod.id}/main.png`)) || prod.image;
    }

    // 2. Images gallery
    if (Array.isArray(prod.images)) {
      const newImgs: string[] = [];
      for (let i = 0; i < prod.images.length; i++) {
        const url = await uploadToStorage(prod.images[i], `products/${prod.id}/gallery_${i}.png`);
        if (url) newImgs.push(url);
      }
      prod.images = newImgs;
    }

    // 3. Color options
    if (Array.isArray(prod.colorOptions)) {
      for (let i = 0; i < prod.colorOptions.length; i++) {
        if (prod.colorOptions[i].image) {
          prod.colorOptions[i].image = (await uploadToStorage(prod.colorOptions[i].image, `products/${prod.id}/color_${i}.png`)) || prod.colorOptions[i].image;
        }
      }
    }

    // 4. Charm options
    if (Array.isArray(prod.charmOptions)) {
      for (let i = 0; i < prod.charmOptions.length; i++) {
        const c = prod.charmOptions[i];
        if (c.image) {
          c.image = (await uploadToStorage(c.image, `products/${prod.id}/charm_${c.id || i}.png`)) || c.image;
        }
      }
    }

    // 5. Omamori options
    if (Array.isArray(prod.omamoriOptions)) {
      for (let i = 0; i < prod.omamoriOptions.length; i++) {
        const o = prod.omamoriOptions[i];
        if (o.image) {
          o.image = (await uploadToStorage(o.image, `products/${prod.id}/omamori_${o.id || i}.png`)) || o.image;
        }
      }
    }

    // 6. Khoen options
    if (Array.isArray(prod.khoenOptions)) {
      for (let i = 0; i < prod.khoenOptions.length; i++) {
        const k = prod.khoenOptions[i];
        if (k.image) {
          k.image = (await uploadToStorage(k.image, `products/${prod.id}/khoen_${k.id || i}.png`)) || k.image;
        }
      }
    }

    // Save updated product to Firestore with clean Storage URLs
    await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
    console.log('Successfully updated product in Firestore:', prod.id);
  }

  // Also migrate categories
  console.log('\n--- Migrating Categories to Firebase Storage...');
  const catSnap = await getDocs(collection(db, 'categories'));
  for (const docSnap of catSnap.docs) {
    const cat = { id: docSnap.id, ...docSnap.data() } as any;
    if (cat.bannerImage) {
      cat.bannerImage = await uploadToStorage(cat.bannerImage, `categories/${cat.id}/banner.png`);
      await setDoc(doc(db, 'categories', cat.id), cat, { merge: true });
      console.log('Updated category banner:', cat.id);
    }
  }

  // Also migrate collections
  console.log('\n--- Migrating Collections to Firebase Storage...');
  const colSnap = await getDocs(collection(db, 'collections'));
  for (const docSnap of colSnap.docs) {
    const col = { id: docSnap.id, ...docSnap.data() } as any;
    if (col.bgImage) {
      col.bgImage = await uploadToStorage(col.bgImage, `collections/${col.id}/bg.png`);
      await setDoc(doc(db, 'collections', col.id), col, { merge: true });
      console.log('Updated collection bgImage:', col.id);
    }
  }

  console.log('\n=== ALL MIGRATIONS TO FIREBASE STORAGE COMPLETE ===');
  process.exit(0);
}

migrateAllProducts();
