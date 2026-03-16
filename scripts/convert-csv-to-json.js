import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = process.argv[2] || path.join(__dirname, '../Oxatis-All-xeilom-26993 - Oxatis-All-xeilom-26993.csv_avec_fiches_corrige.csv');
const fallbackCsvPath = path.join(__dirname, '../../Oxatis-All-xeilom-26993 - Oxatis-All-xeilom-26993.csv_avec_fiches_corrige.csv');

function getCsvPath() {
  if (fs.existsSync(csvPath)) return csvPath;
  if (fs.existsSync(fallbackCsvPath)) return fallbackCsvPath;
  throw new Error(`CSV file not found. Tried: ${csvPath} and ${fallbackCsvPath}`);
}

const resolvedCsvPath = getCsvPath();
const csv = fs.readFileSync(resolvedCsvPath, 'utf-8');

const { data: rows, errors } = Papa.parse(csv, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

if (errors.length > 0) {
  console.warn(`CSV parsing warnings: ${errors.length} issue(s)`);
  errors.slice(0, 5).forEach((e) => console.warn(`  Row ${e.row}: ${e.message}`));
}

const products = [];
const categoriesSet = new Set();
const brandsSet = new Set();

for (const row of rows) {
  const category1 = (row.Category1Name || '').trim();
  const mainCategory = category1.split('\\')[0]?.trim() || 'Autres';

  if (mainCategory) categoriesSet.add(mainCategory);
  const brand = (row.BrandName || '').trim() || 'Générique';
  if (brand) brandsSet.add(brand);

  const sheetUrl = (row.ProductSheetUrl || '').trim();
  const hasSheet = sheetUrl.length > 0 && /^https?:\/\//i.test(sheetUrl);
  const isPBFilePlayer = hasSheet && sheetUrl.includes('PBFilePlayer.asp');

  products.push({
    id: String(row.OxatisId || '').trim(),
    sku: (row.ItemSKU || '').trim(),
    name: (row.Name || '').trim(),
    category: mainCategory,
    categoryFull: category1,
    brand,
    description: (row.ShortDescription || row.LongDescription || row.Name || '').trim(),
    image: (row.UrlBigImgFileName || row.UrlSmallImgFileName || '').trim(),
    imageSmall: (row.UrlSmallImgFileName || row.UrlBigImgFileName || '').trim(),
    productUrl: (row.ProductUrl || '').trim(),
    sheetUrl: hasSheet ? sheetUrl : '',
    hasSheet,
    sheetStatus: hasSheet ? (isPBFilePlayer ? 'unavailable' : 'available') : 'none',
  });
}

const output = {
  products,
  categories: Array.from(categoriesSet).sort(),
  brands: Array.from(brandsSet).sort(),
};

const outputDir = path.join(__dirname, '../public/data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'products.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`Converted: ${products.length} products, ${output.categories.length} categories, ${output.brands.length} brands`);
console.log(`Output: ${outputPath}`);
