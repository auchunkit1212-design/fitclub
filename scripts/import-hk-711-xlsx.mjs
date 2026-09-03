/**
 * Import HK 7-11 nutrition xlsx → src/data/hk_711_food.json
 * Usage: node scripts/import-hk-711-xlsx.mjs [path-to-xlsx]
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultXlsx = join(
  process.env.HOME ?? "",
  "Downloads/HK_711_Nutrition_Database_v2_200Items.xlsx"
);
const xlsxPath = process.argv[2] ?? defaultXlsx;
const outPath = join(root, "src/data/hk_711_food.json");

const py = `
import zipfile, xml.etree.ElementTree as ET, re, json, sys
path = sys.argv[1]
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def col_idx(ref):
    m = re.match(r'([A-Z]+)', ref)
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - 64)
    return col - 1

def cell_val(c):
    is_el = c.find('m:is', ns)
    if is_el is not None:
        return ''.join(t.text or '' for t in is_el.findall('.//m:t', ns))
    v = c.find('m:v', ns)
    return v.text if v is not None else ''

with zipfile.ZipFile(path) as z:
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet.findall('m:sheetData/m:row', ns):
        row_data = {}
        for c in row.findall('m:c', ns):
            row_data[col_idx(c.get('r',''))] = cell_val(c)
        if row_data:
            max_col = max(row_data)
            rows.append([row_data.get(i,'') for i in range(max_col+1)])

items = []
for r in rows[1:]:
    if len(r) < 8:
        continue
    brand_line, zh, en, cat = r[0].strip(), r[1].strip(), r[2].strip(), r[3].strip()
    if not zh and not en:
        continue
    try:
        cal = int(round(float(r[4])))
        pro = int(round(float(r[5])))
        carb = int(round(float(r[6])))
        fat = int(round(float(r[7])))
        sodium = int(round(float(r[8]))) if len(r) > 8 and r[8] else None
        sugar = int(round(float(r[9]))) if len(r) > 9 and r[9] else None
    except (TypeError, ValueError):
        continue
    aliases = [a for a in [en, brand_line, cat, f"7-11 {zh}", f"711 {zh}"] if a and a != zh]
    items.append({
        "food_name": zh or en,
        "aliases": aliases,
        "calories": cal,
        "protein": pro,
        "carbs": carb,
        "fat": fat,
        "weight_g": 1,
        "region": "HK",
        "store": "7-11",
        "brand_line": brand_line,
        "category": cat,
        "sodium_mg": sodium,
        "sugar_g": sugar,
    })

print(json.dumps(items, ensure_ascii=False, indent=2))
`;

const json = execFileSync("python3", ["-c", py, xlsxPath], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

const parsed = JSON.parse(json);
writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(`Wrote ${parsed.length} items → ${outPath}`);
