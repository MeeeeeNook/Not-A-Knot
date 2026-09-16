const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  /allow read: if isTeamMember\(\) \|\| true;[^\n]*\n\s*allow list: if isTeamMember\(\);\s*\n\s*allow get: if true;/g,
  `allow get: if true;\n      allow list: if isTeamMember();`
);

fs.writeFileSync('firestore.rules', content);
