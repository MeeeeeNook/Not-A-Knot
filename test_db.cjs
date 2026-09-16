const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'jittery-study-nzp2g' }); // Using generic test id
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('sellers').get();
  console.log("Sellers in DB:");
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().username, doc.data().isRootAdmin);
  });
}
run();
