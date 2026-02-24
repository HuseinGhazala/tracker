# مرجع أقسام (البانels) ملف النسخة الاحتياطية

ملف `financial_tracker_backup_2026-02-24.json` يحتوي على **7 أقسام** (panels/collections). هذا المستند يوضح هيكل كل قسم وعدد السجلات في النسخة الحالية.

---

## 1. `clients` — العملاء  
**العدد في النسخة الاحتياطية: 112**

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string (UUID) | معرف فريد |
| `name` | string | اسم العميل |
| `project` | string | اسم المشروع |
| `totalProjectCost` | number | إجمالي تكلفة المشروع |
| `currency` | string | العملة (مثل `"USD"`, `"EGP"`) |
| `creationDate` | string (ISO) | تاريخ الإنشاء |

**ملاحظة:** لا يوجد حقل `totalPaid` في النسخة الاحتياطية؛ يُحسب من مجموع دفعات العميل في `payments`.

---

## 2. `payments` — الدفعات  
**العدد في النسخة الاحتياطية: 114**

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string (UUID) | معرف فريد |
| `clientId` | string (UUID) | معرف العميل (مرجع إلى `clients.id`) |
| `amount` | number | المبلغ |
| `paymentDate` | string (ISO) | تاريخ الدفع |
| `currency` | string | العملة |
| `notes` | string (اختياري) | ملاحظات |
| `creationDate` | string (ISO) | تاريخ إنشاء السجل |

---

## 3. `debts` — الديون  
**العدد في النسخة الاحتياطية: 4**

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string (UUID) | معرف فريد |
| `description` | string | وصف الدين |
| `debtorName` | string | اسم المدين |
| `creditorName` | string | اسم الدائن |
| `amount` | number | المبلغ |
| `currency` | string | العملة |
| `dueDate` | string (ISO) | تاريخ الاستحقاق |
| `status` | string | الحالة (مثل `"paid"`) |
| `amountRepaid` | number | المبلغ المسدد |
| `paidDate` | string (ISO) | تاريخ السداد |
| `notes` | string | ملاحظات |
| `creationDate` | string (ISO) | تاريخ الإنشاء |

---

## 4. `appointments` — المواعيد  
**العدد في النسخة الاحتياطية: 0** (فارغ)

هيكل الموعد في التطبيق (للاستيراد لاحقاً إن وُجدت بيانات):

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string | معرف فريد |
| `title` | string | عنوان الموعد |
| `date` | date | التاريخ |
| `time` | string | الوقت (HH:MM) |
| `attendees` | string (اختياري) | الحضور |
| `location` | string (اختياري) | المكان |
| `notes` | string (اختياري) | ملاحظات |
| `status` | enum | الحالة (مثل `scheduled`) |
| `creationDate` | date (اختياري) | تاريخ الإنشاء |

---

## 5. `tasks` — المهام  
**العدد في النسخة الاحتياطية: 0** (فارغ)

هيكل المهمة في التطبيق:

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string | معرف فريد |
| `description` | string | وصف المهمة |
| `dueDate` | date (اختياري) | تاريخ الاستحقاق |
| `priority` | enum | أولوية: `low` \| `medium` \| `high` |
| `status` | enum | الحالة (مثل `todo`) |
| `notes` | string (اختياري) | ملاحظات |
| `creationDate` | date (اختياري) | تاريخ الإنشاء |

---

## 6. `expenses` — المصروفات  
**العدد في النسخة الاحتياطية: 48**

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string (UUID) | معرف فريد |
| `description` | string | وصف المصروف |
| `amount` | number | المبلغ |
| `currency` | string | العملة |
| `category` | string | التصنيف (انظر أدناه) |
| `expenseDate` | string (ISO) | تاريخ المصروف |
| `creationDate` | string (ISO) | تاريخ الإنشاء |

**قيم `category` المستخدمة في النسخة الاحتياطية:**  
`transport`, `entertainment`, `other`, `charity`, `bills` (وقد توجد غيرها في التطبيق).

---

## 7. `savingsGoals` — أهداف التوفير  
**العدد في النسخة الاحتياطية: 0** (فارغ)

هيكل هدف التوفير في التطبيق:

| الحقل | النوع | وصف |
|--------|--------|------|
| `id` | string | معرف فريد |
| `name` | string | اسم الهدف |
| `goalType` | enum | نوع الهدف: `currency` \| `gold` |
| `targetAmount` | number | المبلغ المستهدف |
| `currentAmount` | number | المبلغ الحالي |
| `currency` | string (اختياري) | العملة (مطلوب إذا `goalType === 'currency'`) |
| `creationDate` | date | تاريخ الإنشاء |

---

## ملخص الأعداد

| القسم | العدد | ملاحظات |
|--------|--------|----------|
| clients | 112 | مُستورد إلى Supabase |
| payments | 114 | مُستورد إلى Supabase |
| debts | 4 | مُستورد إلى Supabase |
| appointments | 0 | فارغ (الجدول جاهز للاستيراد) |
| tasks | 0 | فارغ (الجدول جاهز للاستيراد) |
| expenses | 48 | مُستورد إلى Supabase |
| savingsGoals | 0 | فارغ (الجدول جاهز للاستيراد) |

---

## ما يُستورد إلى Supabase

سكربت `scripts/import-backup-to-supabase.ts` ياستورد **كل** الأقسام: clients, payments, debts, expenses, appointments, tasks, savingsGoals. شغّل أولاً محتوى `supabase/schema.sql` في Supabase (SQL Editor) ثم: `IMPORT_USER_ID=معرفك npm run import-backup`.
