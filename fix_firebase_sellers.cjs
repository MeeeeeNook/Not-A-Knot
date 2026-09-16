const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

code = code.replace(
  /export const fetchSellersFromFirestore = async \(\): Promise<SellerUser\[\]> => \{/,
  "export const fetchSellersFromFirestore = async (): Promise<SellerUser[]> => {\n  await ensureAuthReady();"
);

fs.writeFileSync('src/firebase.ts', code);
