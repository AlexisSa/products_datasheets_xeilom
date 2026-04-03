#!/usr/bin/env node
/**
 * Audit des sheetUrl dans public/data/products.json.
 * Détecte espaces / URLs illisibles et teste la disponibilité HTTP (HEAD puis GET partiel).
 *
 * Usage: node scripts/audit-sheet-urls.js [--out reports/sheet-audit.json]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'public/data/products.json');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': BROWSER_UA,
  Referer: 'https://www.xeilom.fr/',
  Origin: 'https://www.xeilom.fr',
  Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const CONCURRENCY = 8;
const TIMEOUT_MS = 22_000;

function encodePathnameSegments(pathname) {
  return pathname
    .split('/')
    .map((part) => {
      if (!part) return '';
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join('/') || '/';
}

function normalizePdfUrl(raw) {
  const t = String(raw).trim();
  let u;
  try {
    u = new URL(t);
  } catch {
    const m = t.match(/^(https?:\/\/[^/?#]+)([^#]*)(#.*)?$/i);
    if (!m) return null;
    const originAndHost = m[1];
    const pathQuery = m[2] || '/';
    const hash = m[3] || '';
    const qIndex = pathQuery.indexOf('?');
    const pathname = qIndex >= 0 ? pathQuery.slice(0, qIndex) : pathQuery || '/';
    const search = qIndex >= 0 ? pathQuery.slice(qIndex) : '';
    const encodedPath = encodePathnameSegments(pathname);
    const rebuilt = `${originAndHost}${encodedPath}${search}${hash}`;
    try {
      u = new URL(rebuilt);
    } catch {
      return null;
    }
  }
  const newPath = encodePathnameSegments(u.pathname);
  try {
    return new URL(newPath + u.search + u.hash, u.origin).href;
  } catch {
    return null;
  }
}

async function probeUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      headers: BROWSER_HEADERS,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    let method = 'HEAD';
    if (
      res.status === 403 ||
      res.status === 405 ||
      res.status === 501 ||
      res.status === 400
    ) {
      res = await fetch(url, {
        method: 'GET',
        headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      method = 'GET_RANGE';
    }
    const ct = res.headers.get('content-type') || '';
    const okPdf =
      res.ok && (ct.includes('pdf') || ct.includes('octet-stream'));
    return {
      method,
      status: res.status,
      contentType: ct,
      okPdf,
      ok: res.ok,
    };
  } catch (e) {
    return {
      method: 'ERROR',
      status: 0,
      contentType: '',
      okPdf: false,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

async function runPool(items, limit, worker) {
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    await worker(items[idx], idx);
    await next();
  }
  const starters = Array.from({ length: Math.min(limit, items.length) }, () =>
    next()
  );
  await Promise.all(starters);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let out = path.join(ROOT, 'reports', 'sheet-audit.json');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = path.isAbsolute(args[i + 1])
        ? args[i + 1]
        : path.join(ROOT, args[i + 1]);
      i++;
    }
  }
  return { out };
}

async function main() {
  const { out } = parseArgs();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const { products } = JSON.parse(raw);
  if (!Array.isArray(products)) {
    console.error('Format products.json invalide');
    process.exit(1);
  }

  const rows = [];
  const withSheet = products.filter((p) => p.sheetUrl && p.hasSheet);

  await runPool(withSheet, CONCURRENCY, async (p) => {
    const sheetUrl = p.sheetUrl;
    const rawHasSpace = /\s/.test(sheetUrl);
    const normalized = normalizePdfUrl(sheetUrl);
    const probeTarget = normalized || sheetUrl;
    const probe = await probeUrl(probeTarget);

    let issue = null;
    if (!normalized) issue = 'INVALID_URL';
    else if (rawHasSpace) issue = 'RAW_URL_HAS_WHITESPACE';
    if (!probe.ok && probe.status !== 0) {
      if (probe.status === 403) issue = issue ? `${issue}+HTTP_403` : 'HTTP_403';
      else if (probe.status === 404) issue = issue ? `${issue}+HTTP_404` : 'HTTP_404';
      else if (!issue) issue = `HTTP_${probe.status}`;
    }
    const ct = probe.contentType || '';
    if (probe.ok && !probe.okPdf && !ct.includes('html')) {
      if (!issue) issue = 'NOT_CLEAR_PDF_TYPE';
    }
    if (probe.ok && ct.includes('text/html')) {
      issue = issue ? `${issue}+HTML_RESPONSE` : 'HTML_RESPONSE';
    }

    rows.push({
      id: p.id,
      sku: p.sku,
      name: p.name,
      sheetUrl,
      normalizedUrl: normalized,
      rawHasSpace,
      sheetStatus: p.sheetStatus,
      probeMethod: probe.method,
      httpStatus: probe.status,
      contentType: probe.contentType,
      okPdf: probe.okPdf,
      probeError: probe.error ?? null,
      issue,
    });
  });

  const summary = {
    totalProducts: products.length,
    withSheet: withSheet.length,
    rawUrlHasWhitespace: rows.filter((r) => r.rawHasSpace).length,
    invalidUrl: rows.filter((r) => !r.normalizedUrl).length,
    http403: rows.filter((r) => r.httpStatus === 403).length,
    http404: rows.filter((r) => r.httpStatus === 404).length,
    probeErrors: rows.filter((r) => r.probeError).length,
    withIssue: rows.filter((r) => r.issue).length,
  };

  const report = { generatedAt: new Date().toISOString(), summary, rows };
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = out.replace(/\.json$/i, '.csv');
  const csvHeader =
    'id,sku,sheetUrl,httpStatus,issue,rawHasSpace,contentType\n';
  const csvBody = rows
    .map((r) =>
      [
        r.id,
        r.sku,
        JSON.stringify(r.sheetUrl),
        r.httpStatus,
        JSON.stringify(r.issue || ''),
        r.rawHasSpace,
        JSON.stringify(r.contentType || ''),
      ].join(',')
    )
    .join('\n');
  await fs.writeFile(csvPath, csvHeader + csvBody, 'utf8');

  console.log('Résumé:', summary);
  console.log('JSON:', out);
  console.log('CSV:', csvPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
