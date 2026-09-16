const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The easiest way is to disable validation entirely for the rate limiters
content = content.replace(/validate: \{[\s\S]*?\},/g, 'validate: false,');

fs.writeFileSync('server.ts', content);
