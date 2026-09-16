const admin = require('firebase-admin');
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS) : undefined;
if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.initializeApp({ projectId: 'jittery-study-nzp2g' }); // mock id
}

async function run() {
  const db = admin.firestore();
  const snapshot = await db.collection('sellers').get();
  console.log("Sellers in DB:");
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().username, doc.data().email);
  });
}
run();
