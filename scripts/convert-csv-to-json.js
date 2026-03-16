import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = process.argv[2] || path.join(__dirname, '../Oxatis-All-xeilom-26993 - Oxatis-All-xeilom-26993.csv_avec_fiches_corrige.csv');
const fallbackCsvPath = path.join(__dirname, '../../Oxatis-All-xeilom-26993 - Oxatis-All-xeilom-26993.csv_avec_fiches_corrige.csv');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\r') {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function getCsvPath() {
  if (fs.existsSync(csvPath)) return csvPath;
  if (fs.existsSync(fallbackCsvPath)) return fallbackCsvPath;
  throw new Error(`CSV file not found. Tried: ${csvPath} and ${fallbackCsvPath}`);
}

const resolvedCsvPath = getCsvPath();
const csv = fs.readFileSync(resolvedCsvPath, 'utf-8');
const lines = csv.split('\n').filter((l) => l.trim());
const headers = parseCSVLine(lines[0]);

const products = [];
const categoriesSet = new Set();
const brandsSet = new Set();

for (let i = 1; i < lines.length; i++) {
  const values = parseCSVLine(lines[i]);
  if (values.length < 2) continue;

  const row = {};
  headers.forEach((h, idx) => {
    row[h] = values[idx] || '';
  });

  const category1 = row.Category1Name || '';
  const mainCategory = category1.split('\\')[0]?.trim() || 'Autres';

  if (mainCategory) categoriesSet.add(mainCategory);
  const brand = row.BrandName?.trim() || 'Générique';
  if (brand) brandsSet.add(brand);

  const sheetUrl = (row.ProductSheetUrl || '').trim();
  const hasSheet = sheetUrl.length > 0 && !sheetUrl.endsWith(',');

  products.push({
    id: String(row.OxatisId || '').trim(),
    sku: (row.ItemSKU || '').trim(),
    name: (row.Name || '').trim(),
    category: mainCategory,
    categoryFull: category1,
    brand,
    description: (row.Name || '').trim(),
    image: (row.UrlBigImgFileName || row.UrlSmallImgFileName || '').trim(),
    imageSmall: (row.UrlSmallImgFileName || row.UrlBigImgFileName || '').trim(),
    productUrl: (row.ProductUrl || '').trim(),
    sheetUrl: hasSheet ? sheetUrl : '',
    hasSheet,
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
