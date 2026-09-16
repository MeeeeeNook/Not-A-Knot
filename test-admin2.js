import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'jittery-study-nzp2g',
});

const db = getFirestore(app);
db.collection('test').limit(1).get().then(snap => {
  console.log('Success, docs:', snap.size);
}).catch(e => {
  console.error('Error:', e);
});
