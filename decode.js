const CIPHER_KEY = 'NAK_DB_SECRET_CIPHER_2026';
const decodeDbParam = (encodedStr) => {
  try {
    const raw = atob(encodedStr);
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length));
    }
    return out;
  } catch {
    return '';
  }
};
console.log(decodeDbParam('JCg/KyEwJn42NychLXItMyB6Ig=='));
