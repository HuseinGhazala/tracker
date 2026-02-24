# استيراد العملاء والدفعات من CSV إلى Supabase

جدول `clients` و `payments` مضبطان ليقبلا استيراد CSV مباشر (نفس أعمدة الملفات المُصدَّرة).

**من داخل التطبيق:** بعد تسجيل الدخول افتح المسار **`/import`** وارفع ملف العملاء و/أو ملف الدفعات (بنفس تنسيق التصدير). سيتم ربط البيانات تلقائياً بحسابك.

## خطوات الاستيراد

### 1. تشغيل الـ Schema
في Supabase: **SQL Editor** → New query → الصق محتوى `schema.sql` → **Run**.

### 2. إضافة المستخدم
في SQL Editor نفّذ (بدّل `معرف_فيربيس_الخاص_بك` بمعرفك من Firebase):

```sql
INSERT INTO users (id) VALUES ('معرف_فيربيس_الخاص_بك') ON CONFLICT (id) DO NOTHING;
```

### 3. تعديل ملف الـ CSV
افتح ملف الـ CSV (مثلاً `clients_export_2026-02-24.csv`) واستبدل **كل** ظهورات:

- `<REPLACE_WITH_YOUR_SUPABASE_USER_ID>`

بمعرف المستخدم نفسه (نفس القيمة اللي حطيتها في الخطوة 2)، ثم احفظ الملف.

### 4. الاستيراد من الواجهة
1. **Table Editor** → اختر جدول **clients**
2. **Import data from CSV** (أو Import data)
3. اختر الملف اللي عدّلته
4. تأكد أن الأعمدة متطابقة: `id`, `user_id`, `name`, `project`, `total_project_cost`, `currency`, `total_paid`, `created_at`
5. نفّذ الاستيراد

بعدها تظهر الصفوف في جدول `clients` وتقدر تستخدمها من التطبيق.

---

## استيراد الدفعات (payments)

1. **تأكد أن جدول العملاء مُستورد أولاً** لأن كل دفعة مرتبطة بعميل (`client_id`).
2. جهّز ملف الدفعات:
   ```bash
   CSV_FILE=/المسار/إلى/payments_export_2026-02-24.csv npm run prepare-payments-csv
   ```
3. في Supabase: **Table Editor** → جدول **payments** → **Import data from CSV** واختر الملف الناتج `payments_import_ready.csv`.

4. **مزامنة إجمالي المدفوع للعملاء** (بعد استيراد الدفعات، نفّذ مرة واحدة في SQL Editor):
   ```sql
   UPDATE clients c
   SET total_paid = (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.client_id = c.id);
   ```

---

## إذا ظهر خطأ Foreign Key

الرسالة: `Key (user_id)=(<REPLACE_WITH_YOUR_SUPABASE_USER_ID>) is not present in table "users"` تعني:

1. **لم تُضف المستخدم في جدول `users`**  
   نفّذ في SQL Editor (بدّل القيمة بمعرفك الحقيقي من Firebase):
   ```sql
   INSERT INTO users (id) VALUES ('معرف_فيربيس_الخاص_بك') ON CONFLICT (id) DO NOTHING;
   ```

2. **لم تُستبدل القيمة في الـ CSV**  
   في ملف الـ CSV يجب استبدال **كل** ظهورات `<REPLACE_WITH_YOUR_SUPABASE_USER_ID>` بمعرف المستخدم **نفسه** اللي حطيته في الأمر أعلاه (نص طويل من حروف وأرقام من Firebase).

### أو: توليد CSV جاهز من السكربت
1. ضع في `.env`: `IMPORT_USER_ID=معرفك_من_فيربيس`
2. من جذر المشروع (إذا كان الـ CSV في المشروع باسم `clients_export_2026-02-24.csv`):
   ```bash
   npm run prepare-clients-csv
   ```
   أو إذا الملف في مكان آخر (مثلاً Downloads):
   ```bash
   CSV_FILE=/المسار/إلى/clients_export_2026-02-24.csv npm run prepare-clients-csv
   ```
3. استورد الملف الناتج `clients_import_ready.csv` من Table Editor → clients → Import.
