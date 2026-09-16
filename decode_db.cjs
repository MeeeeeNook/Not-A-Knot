const ENCRYPTED_CONFIG = {  projectId: 'JCg/KyEwJn42NychLXItMyB6Ig==',  appId: 'f3t5bHdybmdwe2N0bWU0LDJyI2U6VwIFByh1eT0nc241IHNgdGI6cQ==',  apiKey: 'DwgxPhc7GyMidCsPDj4OERcpAiY9fmdGbn9zAAYpMytgdHIKAzsW',  authDomain: 'JCg/KyEwJn42NychLXItMyB6Inw5W0JXVC8yLj40MnEwKi4=',  firestoreDatabaseId: 'LyhmLDA3OzoqbiAgOTY7OzUlLCoxXURTXSBsfT18em1kcnp/dDJpImRkeHIxclNWBgJjdilrcnpvancga3Ay',  storageBucket: 'JCg/KyEwJn42NychLXItMyB6Inw5W0JXVC8yLiwwLS0yIiZ8JCQv',  messagingSenderId: 'fHJ4b3V2amt0cms='};

const decodeDbParam = (encoded) => {
  if (!encoded) return '';
  try {
    const b = Buffer.from(encoded, 'base64').toString('utf8');
    let res = '';
    for (let i = 0; i < b.length; i++) {
      res += String.fromCharCode(b.charCodeAt(i) ^ (i % 256));
    }
    return res;
  } catch (e) {
    return '';
  }
};

console.log("Database ID:", decodeDbParam(ENCRYPTED_CONFIG.firestoreDatabaseId));
