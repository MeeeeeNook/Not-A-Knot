import {
  fetchBackupScheduleFromFirestore,
  saveBackupScheduleToFirestore,
  fetchProductsFromFirestore,
  fetchCategoriesFromFirestore,
  fetchCollectionsFromFirestore,
  fetchSiteContentFromFirestore,
  saveBackupToFirestore
} from '../firebase';
import { VersionBackup, BackupScheduleConfig } from '../types';
import { logSystemActivity } from './logger';

let isBackupRunning = false;

/**
 * Checks auto-backup schedule and executes automatic version backup if due.
 * Works seamlessly in the background whenever the application is online or loaded by any visitor/admin.
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

    let isDue = false;
    if (!schedule.lastBackupAt) {
      isDue = true;
    } else {
      const lastTime = new Date(schedule.lastBackupAt).getTime();
      if (isNaN(lastTime) || (now - lastTime >= intervalMs)) {
        isDue = true;
      }
    }

    if (!isDue) {
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
