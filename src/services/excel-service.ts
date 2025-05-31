
'use server';
/**
 * @fileOverview Service for generating Excel reports using exceljs.
 */
import ExcelJS from 'exceljs';
import type { Currency } from '@/app/page';
import { format as formatDateFn } from 'date-fns';
import { arSA } from 'date-fns/locale';

// Ensure this matches the CURRENCIES object in app/page.tsx
const CURRENCIES_MAP = {
    EGP: 'جنيه مصري',
    SAR: 'ريال سعودي',
    USD: 'دولار أمريكي',
    CAD: 'دولار كندي',
    EUR: 'يورو',
} as const;

const EXPENSE_CATEGORIES_MAP = {
    food: 'طعام وشراب',
    transport: 'مواصلات',
    housing: 'سكن ومعيشة',
    bills: 'فواتير وخدمات',
    health: 'صحة وعلاج',
    education: 'تعليم وتطوير',
    entertainment: 'ترفيه وتسوق',
    personal: 'عناية شخصية',
    charity: 'صدقات وتبرعات',
    other: 'مصروفات أخرى',
} as const;
type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES_MAP;


interface ReportData {
  clients: any[];
  debts: any[];
  expenses: any[]; // Added expenses
  summary: {
    totalPaidUSD: number | null;
    totalRemainingUSD: number | null;
    totalOutstandingDebtUSD: number | null;
    totalExpensesUSD: number | null; // Added totalExpensesUSD
  };
  reportDate: Date;
}

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Financial Tracker App';
  workbook.created = data.reportDate;
  workbook.modified = new Date();

  // --- Clients Sheet ---
  const clientsSheet = workbook.addWorksheet('العملاء');
  clientsSheet.views = [{ rightToLeft: true }];

  clientsSheet.columns = [
    { header: 'اسم العميل', key: 'name', width: 30 },
    { header: 'المشروع', key: 'project', width: 40 },
    { header: 'التكلفة الإجمالية', key: 'totalProjectCost', width: 20, style: { numFmt: '#,##0.00' } },
    { header: 'العملة', key: 'currency', width: 15 },
    { header: 'إجمالي المدفوع', key: 'totalPaid', width: 20, style: { numFmt: '#,##0.00' } },
    { header: 'المتبقي', key: 'remaining', width: 20, style: { numFmt: '#,##0.00' } },
  ];
  const clientHeaderRow = clientsSheet.getRow(1);
  clientHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  clientHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } };
  clientHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };


  data.clients.forEach((client: any) => {
    const totalPaid = (client.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const remaining = (client.totalProjectCost || 0) - totalPaid;
    clientsSheet.addRow({
      name: client.name,
      project: client.project,
      totalProjectCost: client.totalProjectCost,
      currency: CURRENCIES_MAP[client.currency as Currency] || client.currency,
      totalPaid: totalPaid,
      remaining: remaining,
    });
  });

  // --- Debts Sheet ---
  const debtsSheet = workbook.addWorksheet('الديون');
  debtsSheet.views = [{ rightToLeft: true }];

  debtsSheet.columns = [
    { header: 'الوصف', key: 'description', width: 30 },
    { header: 'المدين', key: 'debtorName', width: 25 },
    { header: 'الدائن', key: 'creditorName', width: 25 },
    { header: 'المبلغ', key: 'amount', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'العملة', key: 'currency', width: 15 },
    { header: 'المسدد', key: 'amountRepaid', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'المتبقي', key: 'remainingDebt', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'الحالة', key: 'status', width: 15 },
    { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 20 },
    { header: 'ملاحظات', key: 'notes', width: 30 },
  ];
  const debtHeaderRow = debtsSheet.getRow(1);
  debtHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  debtHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } };
  debtHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };


  data.debts.forEach((debt: any) => {
    const remainingDebt = (debt.amount || 0) - (debt.amountRepaid || 0);
    debtsSheet.addRow({
      description: debt.description,
      debtorName: debt.debtorName,
      creditorName: debt.creditorName,
      amount: debt.amount,
      currency: CURRENCIES_MAP[debt.currency as Currency] || debt.currency,
      amountRepaid: debt.amountRepaid || 0,
      remainingDebt: remainingDebt,
      status: debt.status,
      dueDate: debt.dueDate ? formatDateFn(new Date(debt.dueDate), 'yyyy-MM-dd', { locale: arSA }) : 'N/A',
      notes: debt.notes || '-',
    });
  });

  // --- Expenses Sheet ---
  const expensesSheet = workbook.addWorksheet('المصروفات');
  expensesSheet.views = [{ rightToLeft: true }];

  expensesSheet.columns = [
    { header: 'الوصف', key: 'description', width: 40 },
    { header: 'المبلغ', key: 'amount', width: 20, style: { numFmt: '#,##0.00' } },
    { header: 'العملة', key: 'currency', width: 15 },
    { header: 'الفئة', key: 'category', width: 25 },
    { header: 'التاريخ', key: 'expenseDate', width: 20 },
  ];
  const expenseHeaderRow = expensesSheet.getRow(1);
  expenseHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  expenseHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } };
  expenseHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  data.expenses.forEach((expense: any) => {
    expensesSheet.addRow({
      description: expense.description,
      amount: expense.amount,
      currency: CURRENCIES_MAP[expense.currency as Currency] || expense.currency,
      category: EXPENSE_CATEGORIES_MAP[expense.category as ExpenseCategoryKey] || expense.category,
      expenseDate: expense.expenseDate ? formatDateFn(new Date(expense.expenseDate), 'yyyy-MM-dd', { locale: arSA }) : 'N/A',
    });
  });


  // --- Summary Sheet ---
  const summarySheet = workbook.addWorksheet('الملخص المالي');
  summarySheet.views = [{ rightToLeft: true }];

  const reportTitleCell = summarySheet.getCell('A1');
  reportTitleCell.value = `تقرير مالي بتاريخ: ${formatDateFn(data.reportDate, 'PPPP', { locale: arSA })}`;
  reportTitleCell.font = { bold: true, size: 14 };
  summarySheet.mergeCells('A1:C1');
  summarySheet.getRow(1).alignment = { horizontal: 'center' };


  summarySheet.addRow([]);

  const addSummaryRow = (label: string, value: number | null, currencyCode: string = 'USD') => {
    const row = summarySheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (value !== null) {
      row.getCell(2).value = `${value.toFixed(2)} ${currencyCode}`;
      row.getCell(2).alignment = { horizontal: 'right' };
    } else {
      row.getCell(2).value = 'N/A';
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  };

  addSummaryRow('إجمالي الدخل المقبوض (دولار أمريكي مقدر):', data.summary.totalPaidUSD);
  addSummaryRow('إجمالي المبالغ المتبقية من العملاء (دولار أمريكي مقدر):', data.summary.totalRemainingUSD);
  addSummaryRow('إجمالي الديون المستحقة عليك (دولار أمريكي مقدر):', data.summary.totalOutstandingDebtUSD);
  addSummaryRow('إجمالي المصروفات (دولار أمريكي مقدر):', data.summary.totalExpensesUSD); // Added total expenses

  summarySheet.getColumn(1).width = 50;
  summarySheet.getColumn(2).width = 30;


  [clientsSheet, debtsSheet, expensesSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      if (!column.width) {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? String(cell.value).length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

