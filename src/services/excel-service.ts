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

interface ReportData {
  clients: any[]; // Consider using a more specific Client type
  debts: any[];   // Consider using a more specific Debt type
  summary: {
    totalPaidUSD: number | null;
    totalRemainingUSD: number | null;
    totalOutstandingDebtUSD: number | null;
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
  clientHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } }; // Teal
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
      status: debt.status, // Ideally map to Arabic status
      dueDate: debt.dueDate ? formatDateFn(new Date(debt.dueDate), 'yyyy-MM-dd', { locale: arSA }) : 'N/A',
      notes: debt.notes || '-',
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


  summarySheet.addRow([]); // Spacer

  const addSummaryRow = (label: string, value: number | null, currencyCode: string = 'USD') => {
    const row = summarySheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (value !== null) {
      // For Excel, it's often better to keep numbers as numbers and apply formatting.
      // The currency symbol can be part of the number format string in Excel.
      // Example numFmt: '$#,##0.00' for USD. For dynamic currencies, this is trickier with simple numFmt.
      // We'll display as text for simplicity here, or one could use conditional formatting in Excel.
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

  summarySheet.getColumn(1).width = 50;
  summarySheet.getColumn(2).width = 30;

  // Auto-width for columns can be resource-intensive.
  // Consider setting fixed widths or more targeted auto-sizing if performance is an issue.
  [clientsSheet, debtsSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      if (!column.width) { // If width is not already set by header definition
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? String(cell.value).length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2; // Basic auto-width
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer); // Convert ArrayBuffer to Buffer
}
