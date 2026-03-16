import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getProxyDownloadUrl } from './config';

export interface BulkDownloadResult {
  success: number;
  failed: number;
  total: number;
}

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
  image?: string;
  imageSmall?: string;
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const blob = await fetchWithProxy(item.sheetUrl);
      const productFolder = rootFolder?.folder(
        (item.sku || 'produit').replace(/[^a-zA-Z0-9.-]/g, '_')
      );
      const pdfExt = 'pdf';
      const pdfName = `${item.sku}-${item.name.slice(0, 50)}.${pdfExt}`.replace(
        /[^a-zA-Z0-9.-]/g,
        '_'
      );
      productFolder?.file(pdfName, blob);

      const imgFolder = productFolder?.folder('img');

      const imageUrls = [item.image, item.imageSmall].filter(
        (u): u is string => !!u
      );

      for (let idx = 0; idx < imageUrls.length; idx++) {
        const url = imageUrls[idx];
        try {
          const imageBlob = await fetchWithProxy(url);
          const urlWithoutQuery = url.split('?')[0];
          const extMatch = urlWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
          const ext = (extMatch?.[1] || 'jpg').toLowerCase();
          const imgName =
            idx === 0
              ? `image.${ext}`
              : `image-${idx + 1}.${ext}`;
          imgFolder?.file(imgName, imageBlob);
        } catch {
        }
      }

      success++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, items.length);
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `fiches-techniques-XEILOM-${date}.zip`;
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, filename);

  return { success, failed, total: items.length };
}
