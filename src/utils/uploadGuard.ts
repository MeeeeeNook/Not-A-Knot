/**
 * Global Upload Guard & BeforeUnload Manager
 * Protects users from accidentally closing the tab or reloading while image uploads are in progress.
 * Displays standard browser confirmation dialog during upload, and triggers success notification when complete.
 */

let activeUploadsCount = 0;

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (activeUploadsCount > 0) {
    const message = 'Ảnh của bạn đang được tải lên máy chủ, vui lòng đợi trong giây lát để tránh bị gián đoạn!';
    e.preventDefault();
    e.returnValue = message;
    return message;
  }
}

/**
 * Triggers a global app toast popup
 */
export function triggerAppToast(
  message: string,
  type: 'success' | 'warning' | 'info' = 'success',
  duration: number = 3500
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('nak:show_toast', {
      detail: { message, type, duration }
    })
  );
}

/**
 * Starts an upload guard session.
 * Arms the browser's beforeunload dialog to prevent tab close/reload during upload.
 */
export function startUploadGuard(): () => void {
  if (typeof window === 'undefined') return () => {};

  activeUploadsCount++;
  if (activeUploadsCount === 1) {
    window.addEventListener('beforeunload', handleBeforeUnload, { capture: true });
  }

  window.dispatchEvent(
    new CustomEvent('nak:upload_state_change', {
      detail: { isUploading: true, activeCount: activeUploadsCount }
    })
  );

  let isFinished = false;
  return () => {
    if (isFinished) return;
    isFinished = true;
    finishUploadGuard(true);
  };
}

/**
 * Finishes an upload guard session.
 * Disarms the beforeunload dialog once all uploads complete, and optionally triggers a success notification.
 */
export function finishUploadGuard(success: boolean = true, successMessage?: string) {
  if (typeof window === 'undefined') return;

  activeUploadsCount = Math.max(0, activeUploadsCount - 1);

  if (activeUploadsCount === 0) {
    window.removeEventListener('beforeunload', handleBeforeUnload, { capture: true });
  }

  window.dispatchEvent(
    new CustomEvent('nak:upload_state_change', {
      detail: { isUploading: activeUploadsCount > 0, activeCount: activeUploadsCount }
    })
  );

  if (success && activeUploadsCount === 0) {
    triggerAppToast(successMessage || 'Đã tải ảnh lên máy chủ thành công! ✨', 'success');
  }
}

/**
 * Checks if any upload is currently in progress
 */
export function isUploadInProgress(): boolean {
  return activeUploadsCount > 0;
}
