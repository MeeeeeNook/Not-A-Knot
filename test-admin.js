import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'jittery-study-nzp2g',
  credential: applicationDefault()
});
const db = getFirestore(app, 'ai-studio-remixremixnotakn-6b882779-1f6a-407c-af44-7b468092c95f');

db.collection('sellers').limit(1).get()
  .then(s => console.log('Admin Success:', s.empty))
  .catch(e => console.error('Admin Error:', e.message));
