import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'ai-studio-remixremixnotakn',
  credential: applicationDefault()
});
const db = getFirestore(app); // default DB

db.collection('sellers').limit(1).get()
  .then(s => console.log('Admin Success:', s.empty))
  .catch(e => console.error('Admin Error:', e.message));
