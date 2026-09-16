const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

if (!code.includes("import { getAuth }")) {
  code = code.replace(
    /import \{ initializeApp, getApps \} from 'firebase\/app';/,
    "import { initializeApp, getApps } from 'firebase/app';\nimport { getAuth } from 'firebase/auth';"
  );
}

// Add ensureAuthReady function
const ensureAuthReadyStr = `
const ensureAuthReady = async () => {
  try {
    const auth = getAuth(app);
    await auth.authStateReady();
  } catch (e) {
    console.warn("Firebase Auth readiness check failed", e);
  }
};
`;

if (!code.includes("ensureAuthReady")) {
  code = code.replace(
    /export const db = firestoreInstance;/,
    "export const db = firestoreInstance;\n\n" + ensureAuthReadyStr
  );
}

// Inject into fetchOrdersFromFirestore
code = code.replace(
  /export const fetchOrdersFromFirestore = async \(\): Promise<StoredOrder\[\]> => \{/,
  "export const fetchOrdersFromFirestore = async (): Promise<StoredOrder[]> => {\n  await ensureAuthReady();"
);

// Inject into fetchContactMessagesFromFirestore
code = code.replace(
  /export const fetchContactMessagesFromFirestore = async \(\): Promise<ContactMessage\[\]> => \{/,
  "export const fetchContactMessagesFromFirestore = async (): Promise<ContactMessage[]> => {\n  await ensureAuthReady();"
);

// We should also inject it into subscribe functions if they exist
code = code.replace(
  /export const subscribeToOrdersFromFirestore = \(callback: \(orders: StoredOrder\[\]\) => void\) => \{/,
  "export const subscribeToOrdersFromFirestore = (callback: (orders: StoredOrder[]) => void) => {\n  ensureAuthReady().then(() => {"
);

code = code.replace(
  /    return onSnapshot\(q, \(snapshot\) => \{[\s\S]*?    \}\);/g,
  (match) => {
    // wait, replacing this globally might be bad.
    return match;
  }
);

fs.writeFileSync('src/firebase.ts', code);
