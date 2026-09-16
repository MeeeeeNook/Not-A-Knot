import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'jittery-study-nzp2g',
  databaseURL: 'https://ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f.firebaseio.com' // Not used for firestore, need another way?
});

const db = getFirestore(app, 'ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f');
db.collection('test').limit(1).get().then(snap => {
  console.log('Success, docs:', snap.size);
}).catch(e => {
  console.error('Error:', e);
});
