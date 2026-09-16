const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

code = code.replace(
  /export const fetchBackupsFromFirestore = async \(\): Promise<VersionBackup\[\]> => \{/,
  "export const fetchBackupsFromFirestore = async (): Promise<VersionBackup[]> => {\n  await ensureAuthReady();"
);

code = code.replace(
  /export const fetchBackupScheduleFromFirestore = async \(\): Promise<BackupScheduleConfig \| null> => \{/,
  "export const fetchBackupScheduleFromFirestore = async (): Promise<BackupScheduleConfig | null> => {\n  await ensureAuthReady();"
);

fs.writeFileSync('src/firebase.ts', code);
