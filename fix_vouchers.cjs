const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  /match \/vouchers\/\{voucherId\} \{\s*\/\/ Vouchers shouldn't be publicly listable[^\n]*\n\s*allow read: if true; \n\s*allow write: if isTeamMember\(\);\s*\}/g,
  `match /vouchers/{voucherId} {\n      allow get: if true;\n      allow list: if isTeamMember();\n      allow write: if isTeamMember();\n    }`
);

fs.writeFileSync('firestore.rules', content);
