import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONCURRENCY = 10;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const REFERER = 'https://www.xeilom.fr/';

const productsPath = path.join(__dirname, '../public/data/products.json');
const data = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

async function resolvePBFilePlayer(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Referer': REFERER },
      redirect: 'manual',
    });

    if (!res.ok) return { resolved: null, reason: `HTTP ${res.status}` };

    const html = await res.text();
    const match = html.match(/window\.location\s*=\s*'([^']+)'/);
    if (!match) return { resolved: null, reason: 'No redirect URL found in HTML' };

    return { resolved: match[1], reason: null };
  } catch (err) {
    return { resolved: null, reason: err.message };
  }
}

async function checkPdfAccessible(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': BROWSER_UA } });
    return res.ok && (res.headers.get('content-type') || '').includes('pdf');
  } catch {
    return false;
  }
}

async function runPool(items, fn, concurrency) {
  let cursor = 0;
  const results = new Array(items.length);

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function main() {
  const pbFilePlayerProducts = data.products.filter(
    (p) => p.sheetUrl && p.sheetUrl.includes('PBFilePlayer.asp')
  );
  const directPdfProducts = data.products.filter(
    (p) => p.sheetUrl && !p.sheetUrl.includes('PBFilePlayer.asp') && p.hasSheet
  );

  console.log(`Total products: ${data.products.length}`);
  console.log(`Direct PDF URLs: ${directPdfProducts.length}`);
  console.log(`PBFilePlayer URLs to resolve: ${pbFilePlayerProducts.length}`);
  console.log('');

  if (pbFilePlayerProducts.length === 0) {
    console.log('Nothing to resolve.');
    return;
  }

  console.log(`Resolving PBFilePlayer URLs (concurrency: ${CONCURRENCY})...`);
  let resolved = 0;
  let failed = 0;
  let accessible = 0;
  let inaccessible = 0;

  const results = await runPool(
    pbFilePlayerProducts,
    async (product, idx) => {
      const result = await resolvePBFilePlayer(product.sheetUrl);

      if (result.resolved) {
        const isAccessible = await checkPdfAccessible(result.resolved);
        if (isAccessible) {
          resolved++;
          accessible++;
          return { product, newUrl: result.resolved, accessible: true };
        } else {
          resolved++;
          inaccessible++;
          return { product, newUrl: result.resolved, accessible: false };
        }
      } else {
        failed++;
        return { product, newUrl: null, reason: result.reason };
      }

      if ((idx + 1) % 50 === 0 || idx === pbFilePlayerProducts.length - 1) {
        process.stdout.write(`\r  Progress: ${idx + 1}/${pbFilePlayerProducts.length}`);
      }
    },
    CONCURRENCY
  );

  console.log('');
  console.log(`\nResults:`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`    Accessible (PDF exists): ${accessible}`);
  console.log(`    Inaccessible (404/error): ${inaccessible}`);
  console.log(`  Failed to resolve: ${failed}`);

  let updated = 0;
  let markedUnavailable = 0;

  for (const result of results) {
    const product = data.products.find((p) => p.id === result.product.id);
    if (!product) continue;

    if (result.newUrl && result.accessible) {
      product.sheetUrl = result.newUrl;
      product.hasSheet = true;
      product.sheetStatus = 'available';
      updated++;
    } else if (result.newUrl && !result.accessible) {
      product.sheetUrl = '';
      product.hasSheet = false;
      product.sheetStatus = 'unavailable';
      markedUnavailable++;
    } else {
      product.sheetUrl = '';
      product.hasSheet = false;
      product.sheetStatus = 'unavailable';
      markedUnavailable++;
    }
  }

  console.log(`\nUpdated products.json:`);
  console.log(`  URLs updated to direct PDF: ${updated}`);
  console.log(`  Marked as unavailable (no sheet): ${markedUnavailable}`);

  fs.writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nSaved: ${productsPath}`);

  const inaccessibleList = results
    .filter((r) => !r.accessible || !r.newUrl)
    .map((r) => `${r.product.sku}\t${r.product.name}\t${r.product.sheetUrl}\t${r.reason || 'PDF 404'}`)
    .join('\n');

  if (inaccessibleList) {
    const reportPath = path.join(__dirname, '../unavailable-pdfs.tsv');
    fs.writeFileSync(
      reportPath,
      `SKU\tName\tOriginalURL\tReason\n${inaccessibleList}\n`,
      'utf-8'
    );
    console.log(`Report of unavailable PDFs: ${reportPath}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
