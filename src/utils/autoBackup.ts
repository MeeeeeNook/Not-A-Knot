import {
  fetchBackupScheduleFromFirestore,
  saveBackupScheduleToFirestore,
  fetchProductsFromFirestore,
  fetchCategoriesFromFirestore,
  fetchCollectionsFromFirestore,
  fetchSiteContentFromFirestore,
  fetchBackupsFromFirestore,
  saveBackupToFirestore
} from '../firebase';
import { VersionBackup, BackupScheduleConfig } from '../types';
import { logSystemActivity } from './logger';

let isBackupRunning = false;

/**
 * Checks auto-backup schedule and executes automatic version backup if due.
 * Verifies both schedule configuration and actual existing backup records
 * to guarantee that backups only run when the full interval (e.g. 6 hours) has elapsed.
 */
export async function checkAndRunAutoBackup(): Promise<boolean> {
  if (isBackupRunning) return false;
  isBackupRunning = true;

  try {
    const schedule = await fetchBackupScheduleFromFirestore();
    if (!schedule || schedule.enabled === false) {
      isBackupRunning = false;
      return false;
    }

    const intervalHours = schedule.intervalHours || 6;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const now = Date.now();

    // Check actual latest backup timestamp from Firestore records
    const existingBackups = await fetchBackupsFromFirestore().catch(() => []);
    let latestBackupTimestamp: number | null = null;

    if (existingBackups.length > 0 && existingBackups[0]?.createdAt) {
      const topTime = new Date(existingBackups[0].createdAt).getTime();
      if (!isNaN(topTime) && topTime > 0) {
        latestBackupTimestamp = topTime;
      }
    }

    if (schedule.lastBackupAt) {
      const schedTime = new Date(schedule.lastBackupAt).getTime();
      if (!isNaN(schedTime) && schedTime > 0) {
        latestBackupTimestamp = Math.max(latestBackupTimestamp || 0, schedTime);
      }
    }

    let isDue = false;
    if (!latestBackupTimestamp || latestBackupTimestamp === 0) {
      isDue = true;
    } else {
      const elapsedMs = now - latestBackupTimestamp;
      if (elapsedMs >= intervalMs) {
        isDue = true;
      } else {
        isDue = false;
      }
    }

    if (!isDue) {
      // If schedule was missing lastBackupAt, keep it synced with latest existing backup
      if (!schedule.lastBackupAt && latestBackupTimestamp) {
        await saveBackupScheduleToFirestore({
          ...schedule,
          lastBackupAt: new Date(latestBackupTimestamp).toISOString()
        });
      }
      isBackupRunning = false;
      return false;
    }

    console.log(`[AutoBackup] Scheduled auto-backup is due (interval: ${intervalHours}h). Starting execution...`);

    const [products, categories, collections, siteContent] = await Promise.all([
      fetchProductsFromFirestore().catch(() => []),
      fetchCategoriesFromFirestore().catch(() => []),
      fetchCollectionsFromFirestore().catch(() => []),
      fetchSiteContentFromFirestore().catch(() => null)
    ]);

    const backupDate = new Date();
    const formattedDate = backupDate.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const newBackup: VersionBackup = {
      id: `backup_${backupDate.getTime()}`,
      createdAt: backupDate.toISOString(),
      formattedDate,
      createdByName: 'Hệ thống tự động',
      backupType: 'auto',
      note: `Sao lưu định kỳ tự động (mỗi ${intervalHours}h)`,
      summary: {
        productsCount: products.length,
        categoriesCount: categories.length,
        collectionsCount: collections.length,
        hasSiteContent: !!siteContent
      },
      data: {
        products,
        categories,
        collections,
        siteContent: siteContent || undefined
      }
    };

    await saveBackupToFirestore(newBackup);

    const updatedSchedule: BackupScheduleConfig = {
      ...schedule,
      lastBackupAt: backupDate.toISOString()
    };
    await saveBackupScheduleToFirestore(updatedSchedule);

    await logSystemActivity(
      'Tự động sao lưu dữ liệu thành công',
      `Hệ thống tự động lưu điểm khôi phục dữ liệu phiên bản (${products.length} sản phẩm, ${categories.length} danh mục).`
    );

    console.log('[AutoBackup] Background auto-backup completed successfully!');
    isBackupRunning = false;
    return true;
  } catch (err) {
    console.warn('[AutoBackup] Background auto-backup execution encountered error:', err);
    isBackupRunning = false;
    return false;
  }
}
