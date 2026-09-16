const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'jittery-study-nzp2g' });

async function run() {
  const db = getFirestore();
  const snapshot = await db.collection('sellers').get();
  console.log("Sellers in DB:");
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().username, doc.data().isRootAdmin);
  });
}
run();
