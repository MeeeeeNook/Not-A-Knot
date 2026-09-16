const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

if (code.includes('ensureAuthReady().then(() => {') && !code.includes('// fixed_subscribe')) {
  // It's probably broken. I will undo it or fix it manually.
  // Actually, I can just use a proper script.
}
