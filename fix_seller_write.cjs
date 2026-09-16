const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  /allow read: if isTeamMember\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid == sellerId\);/,
  "allow read: if isTeamMember() || (isSignedIn() && getSellerId() == sellerId);"
);

rules = rules.replace(
  /allow write: if isRootAdmin\(\) \|\| \(isSignedIn\(\) && request\.auth\.uid == sellerId &&/g,
  "allow write: if isRootAdmin() || (isSignedIn() && getSellerId() == sellerId &&"
);

fs.writeFileSync('firestore.rules', rules);
