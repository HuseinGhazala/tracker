/**
 * يقرأ CSV العملاء ويستبدل <REPLACE_WITH_YOUR_SUPABASE_USER_ID> بـ IMPORT_USER_ID من .env
 * ويكتب ملف clients_import_ready.csv جاهز للاستيراد في Supabase.
 *
 * التشغيل: npm run prepare-clients-csv
 * أو: CSV_FILE=path/to/export.csv npm run prepare-clients-csv
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv();

const IMPORT_USER_ID = process.env.IMPORT_USER_ID;
const CSV_FILE = process.env.CSV_FILE || resolve(process.cwd(), 'clients_export_2026-02-24.csv');
const OUT_FILE = resolve(process.cwd(), 'clients_import_ready.csv');
const PLACEHOLDER = '<REPLACE_WITH_YOUR_SUPABASE_USER_ID>';

function main() {
  if (!IMPORT_USER_ID) {
    console.error('خطأ: أضف IMPORT_USER_ID في .env (معرف المستخدم من Firebase)');
    process.exit(1);
  }
  if (!existsSync(CSV_FILE)) {
    console.error('خطأ: الملف غير موجود:', CSV_FILE);
    console.error('يمكنك تحديد مسار آخر: CSV_FILE=path/to/file.csv npm run prepare-clients-csv');
    process.exit(1);
  }
  const raw = readFileSync(CSV_FILE, 'utf-8');
  const replaced = raw.split(PLACEHOLDER).join(IMPORT_USER_ID);
  writeFileSync(OUT_FILE, replaced, 'utf-8');
  console.log('تم إنشاء:', OUT_FILE);
  console.log('استورد هذا الملف من Supabase → Table Editor → clients → Import data from CSV');
}

main();
