const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /documents\/sellers\/\$\{firebaseUid\}/g,
  "documents/sellers/seller-${firebaseEmail.split('@')[0]}"
);

fs.writeFileSync('server.ts', code);
