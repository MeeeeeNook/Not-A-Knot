const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

// Replace isTeamMember and isRootAdmin
rules = rules.replace(/function isTeamMember\(\) \{[\s\S]*?\}/, 
`function getSellerId() {
      return request.auth.token.email != null ? 'seller-' + request.auth.token.email.replace('@notaknot.local', '') : 'INVALID';
    }
    function isTeamMember() {
      return isSignedIn() && exists(/databases/$(database)/documents/sellers/$(getSellerId()));
    }`);

rules = rules.replace(/function isRootAdmin\(\) \{[\s\S]*?\}/,
`function isRootAdmin() {
      return isSignedIn() && get(/databases/$(database)/documents/sellers/$(getSellerId())).data.isRootAdmin == true;
    }`);

fs.writeFileSync('firestore.rules', rules);
