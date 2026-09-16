const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f' });

async function run() {
  const db = getFirestore();
  const snapshot = await db.collection('sellers').get();
  console.log("Sellers in DB:");
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().username, doc.data().isRootAdmin);
  });
}
run();
