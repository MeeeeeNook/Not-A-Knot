const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldLogic = `      const isRoot = sellerData?.isRootAdmin === true;
      
      if (isRoot) {`;

const newLogic = `      // Retrieve authoritative account data server-side
      let isRoot = false;
      let authoritativeSellerData = sellerData;
      if (FIREBASE_API_KEY && firebaseUid) {
        try {
          // Use the validated ID Token to fetch the user's document securely from Firestore REST API
          const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
          const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'jittery-study-nzp2g';
          const firestoreRes = await fetch(\`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/\${dbId}/documents/sellers/\${firebaseUid}\`, {
            headers: {
              'Authorization': \`Bearer \${idToken}\`
            }
          });
          const firestoreData = await firestoreRes.json();
          if (firestoreData && firestoreData.fields) {
            isRoot = firestoreData.fields.isRootAdmin?.booleanValue === true;
            authoritativeSellerData = {
               name: firestoreData.fields.name?.stringValue || '',
               role: firestoreData.fields.role?.stringValue || 'member',
               avatarColor: firestoreData.fields.avatarColor?.stringValue || '#2563EB',
               isRootAdmin: isRoot
            };
          }
        } catch (e) {
          console.error("Failed to fetch authoritative seller data", e);
        }
      }
      
      if (isRoot) {`;

content = content.replace(oldLogic, newLogic);
// also replace sellerData references inside the payload creation
content = content.replace(/sellerData\?\.name/g, "authoritativeSellerData?.name");
content = content.replace(/sellerData\?\.role/g, "authoritativeSellerData?.role");
content = content.replace(/sellerData\?\.avatarColor/g, "authoritativeSellerData?.avatarColor");

fs.writeFileSync('server.ts', content);
