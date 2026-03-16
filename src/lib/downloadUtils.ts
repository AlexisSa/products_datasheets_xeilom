import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getProxyDownloadUrl } from './config';

export interface BulkDownloadResult {
  success: number;
  failed: number;
  total: number;
}

const CONCURRENCY = 5;

async function fetchWithProxy(url: string): Promise<Blob> {
  const proxyUrl = getProxyDownloadUrl(url);
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('Fetch failed');
  return res.blob();
}

export async function downloadSingle(
  url: string,
  filename: string,
  onFallback?: () => void
): Promise<boolean> {
  try {
    const blob = await fetchWithProxy(url);
    saveAs(blob, filename || 'fiche.pdf');
    return true;
  } catch {
    window.open(url, '_blank');
    onFallback?.();
    return false;
  }
}

export interface BulkDownloadItem {
  name: string;
  sheetUrl: string;
  sku: string;
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number
): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

export async function downloadBulk(
  items: BulkDownloadItem[],
  baseFolderName = 'fiches-techniques',
  onProgress?: (done: number, total: number) => void
): Promise<BulkDownloadResult> {
  const zip = new JSZip();
  const safeBaseFolderName = (baseFolderName || 'fiches-techniques').replace(
    /[^a-zA-Z0-9.-]/g,
    '_'
  );
  const rootFolder = zip.folder(safeBaseFolderName);
  let success = 0;
  let failed = 0;
  let completed = 0;

  await runWithConcurrency(
    items,
    async (item) => {
      try {
        const blob = await fetchWithProxy(item.sheetUrl);
        const productFolder = rootFolder?.folder(
          (item.sku || 'produit').replace(/[^a-zA-Z0-9.-]/g, '_')
        );
        const pdfName = `${item.sku}-${item.name.slice(0, 50)}.pdf`.replace(
          /[^a-zA-Z0-9.-]/g,
          '_'
        );
        productFolder?.file(pdfName, blob);
        success++;
      } catch {
        failed++;
      }
      completed++;
      onProgress?.(completed, items.length);
    },
    CONCURRENCY
  );

  const date = new Date().toISOString().slice(0, 10);
  const filename = `fiches-techniques-XEILOM-${date}.zip`;
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, filename);

  return { success, failed, total: items.length };
}
