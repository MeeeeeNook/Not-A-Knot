import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

const CIPHER_KEY = 'NAK_DB_SECRET_CIPHER_2026';
const decodeDbParam = (encodedStr) => {
  const raw = atob(encodedStr);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length));
  }
  return out;
};
const config = {
  projectId: 'JCg/KyEwJn42NychLXItMyB6Ig==',
  appId: 'f3t5bHdybmdwe2N0bWU0LDJyI2U6VwIFByh1eT0nc241IHNgdGI6cQ==',
  apiKey: 'DwgxPhc7GyMidCsPDj4OERcpAiY9fmdGbn9zAAYpMytgdHIKAzsW',
  authDomain: 'JCg/KyEwJn42NychLXItMyB6Inw5W0JXVC8yLj40MnEwKi4=',
  firestoreDatabaseId: 'LyhmLDA3OzoqbiAgOTY7OzUlLCoxXURTXSBsfT18em1kcnp/dDJpImRkeHIxclNWBgJjdilrcnpvancga3Ay',
  storageBucket: 'JCg/KyEwJn42NychLXItMyB6Inw5W0JXVC8yLiwwLS0yIiZ8JCQv',
  messagingSenderId: 'fHJ4b3V2amt0cms='
};
const firebaseConfig = {
  apiKey: decodeDbParam(config.apiKey),
  authDomain: decodeDbParam(config.authDomain),
  projectId: decodeDbParam(config.projectId),
  storageBucket: decodeDbParam(config.storageBucket),
  messagingSenderId: decodeDbParam(config.messagingSenderId),
  appId: decodeDbParam(config.appId)
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

signInAnonymously(auth)
  .then((user) => console.log('Success Anon:', user.user.uid))
  .catch(e => console.error('Anon Error:', e.code));
