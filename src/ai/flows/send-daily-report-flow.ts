
'use server';
/**
 * @fileOverview Defines a Genkit flow to generate and send a daily financial report.
 *
 * - sendDailyReport - Triggers the report generation and emailing process.
 */

import { ai } from '@/ai/ai-instance';
import type { z } from 'genkit';
import { sendEmail } from '@/services/email-service';
import { generatePdfReport } from '@/services/pdf-service';
import { generateExcelReport } from '@/services/excel-service';
import type { DailyReportInput, DailyReportOutput } from './schemas/daily-report-schemas';
import { DailyReportInputSchema, DailyReportOutputSchema } from './schemas/daily-report-schemas';
import {differenceInDays, endOfMonth, format as formatDateFn} from 'date-fns';
import { arSA } from 'date-fns/locale';


export async function sendDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
    const flowInputData: z.infer<typeof DailyReportInputSchema> = {
        clients: input.clients ?? [],
        debts: input.debts ?? [],
        summary: {
            totalPaidUSD: input.summary?.totalPaidUSD ?? null,
            totalRemainingUSD: input.summary?.totalRemainingUSD ?? null,
            totalOutstandingDebtUSD: input.summary?.totalOutstandingDebtUSD ?? null,
        },
        reportDate: input.reportDate ?? new Date().toISOString(),
        htmlChart: input.htmlChart,
        daysRemainingInYear: input.daysRemainingInYear,
        recipientEmail: input.recipientEmail, // This was correctly passed
    };

    try {
        const result = await dailyReportFlow(flowInputData);
        return result;
    } catch (error: any) {
        console.error("Error executing dailyReportFlow:", error);
        return { success: false, message: `Flow execution failed: ${error.message}` };
    }
}

const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (flowInput) => {
    const reportDate = flowInput.reportDate ? new Date(flowInput.reportDate) : new Date();
    const recipientEmail = flowInput.recipientEmail; // Use email from input

    if (!recipientEmail) {
      console.error('Recipient email is missing in flowInput for dailyReportFlow.');
      return { success: false, message: 'Recipient email is required to send the report.' };
    }

    const reportDateStr = reportDate.toLocaleDateString('ar-SA', { dateStyle: 'full' });
    const subject = `تقريرك المالي اليومي - ${reportDateStr}`;
    const today = new Date();
    const endOfMonthDate = endOfMonth(today);
    const daysRemainingInMonth = differenceInDays(endOfMonthDate, today);

    // Generate a more detailed HTML email body
    let emailHtml = `
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; color: #333; direction: rtl; text-align: right; }
            .container { background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 800px; margin: auto; }
            h1 { color: #008080; text-align: center; }
            h2 { color: #005050; border-bottom: 2px solid #008080; padding-bottom: 5px; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background-color: #e0f2f1; color: #005050; }
            .summary-item { margin-bottom: 10px; font-size: 1.1em; }
            .summary-item strong { color: #008080; }
            .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #777; }
            .chart-container { text-align: center; margin: 20px 0; padding: 10px; background-color: #eef; border-radius: 5px; }
            .chart-container img { max-width: 100%; height: auto; border-radius: 5px; }
            .chart-placeholder { font-style: italic; color: #555; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>${subject}</h1>
            <p class="summary-item">مرحبًا،</p>
            <p class="summary-item">مرفق طيه تقريرك المالي المفصل لليوم الموافق ${reportDateStr} (${formatDateFn(today, 'EEEE', { locale: arSA })}).</p>
            <p class="summary-item">تبقى ${daysRemainingInMonth} يومًا على انتهاء هذا الشهر.</p>
            ${flowInput.daysRemainingInYear !== undefined ? `<p class="summary-item">تبقى ${flowInput.daysRemainingInYear} يومًا على انتهاء هذه السنة.</p>` : ''}

            <h2>ملخص مالي (بالدولار الأمريكي المقدر)</h2>
            <div class="summary-item"><strong>إجمالي الدخل المقبوض:</strong> ${flowInput.summary?.totalPaidUSD?.toFixed(2) ?? 'N/A'} USD</div>
            <div class="summary-item"><strong>إجمالي المبالغ المتبقية من العملاء:</strong> ${flowInput.summary?.totalRemainingUSD?.toFixed(2) ?? 'N/A'} USD</div>
            <div class="summary-item"><strong>إجمالي الديون المستحقة عليك:</strong> ${flowInput.summary?.totalOutstandingDebtUSD?.toFixed(2) ?? 'N/A'} USD</div>

            <h2>تفاصيل العملاء</h2>`;

    if (flowInput.clients && flowInput.clients.length > 0) {
      emailHtml += `
            <table>
                <thead>
                    <tr>
                        <th>اسم العميل</th>
                        <th>المشروع</th>
                        <th>التكلفة الإجمالية</th>
                        <th>العملة</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                    </tr>
                </thead>
                <tbody>`;
      flowInput.clients.forEach((client: any) => {
        const totalPaid = (client.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
        const remaining = client.totalProjectCost - totalPaid;
        emailHtml += `
                    <tr>
                        <td>${client.name}</td>
                        <td>${client.project}</td>
                        <td>${client.totalProjectCost?.toFixed(2)}</td>
                        <td>${client.currency}</td>
                        <td>${totalPaid?.toFixed(2)}</td>
                        <td>${remaining?.toFixed(2)}</td>
                    </tr>`;
      });
      emailHtml += `
                </tbody>
            </table>`;
    } else {
      emailHtml += `<p>لا توجد بيانات عملاء لعرضها.</p>`;
    }

    emailHtml += `<h2>تفاصيل الديون</h2>`;
    if (flowInput.debts && flowInput.debts.length > 0) {
      emailHtml += `
            <table>
                <thead>
                    <tr>
                        <th>الوصف</th>
                        <th>المدين</th>
                        <th>الدائن</th>
                        <th>المبلغ</th>
                        <th>العملة</th>
                        <th>المسدد</th>
                        <th>المتبقي</th>
                        <th>الحالة</th>
                        <th>تاريخ الاستحقاق</th>
                    </tr>
                </thead>
                <tbody>`;
      flowInput.debts.forEach((debt: any) => {
        const remainingDebt = debt.amount - (debt.amountRepaid || 0);
        emailHtml += `
                    <tr>
                        <td>${debt.description}</td>
                        <td>${debt.debtorName}</td>
                        <td>${debt.creditorName}</td>
                        <td>${debt.amount?.toFixed(2)}</td>
                        <td>${debt.currency}</td>
                        <td>${(debt.amountRepaid || 0)?.toFixed(2)}</td>
                        <td>${remainingDebt?.toFixed(2)}</td>
                        <td>${debt.status}</td>
                        <td>${debt.dueDate ? formatDateFn(new Date(debt.dueDate), 'PPP', {locale: arSA}) : 'N/A'}</td>
                    </tr>`;
      });
      emailHtml += `
                </tbody>
            </table>`;
    } else {
      emailHtml += `<p>لا توجد بيانات ديون لعرضها.</p>`;
    }

    emailHtml += `
            <h2>الرسم البياني للدخل الشهري التراكمي (USD)</h2>
            <div class="chart-container">
                ${flowInput.htmlChart || '<p class="chart-placeholder">لم يتمكن النظام من توليد الرسم البياني حاليًا.</p>'}
            </div>

            <p class="summary-item">يرجى مراجعة الملفات المرفقة للحصول على التقرير الكامل بصيغة PDF و Excel.</p>
            <div class="footer">
                مع تحيات،<br>نظام التتبع المالي
            </div>
        </div>
    </body>
    </html>`;


    try {
      const pdfServiceInput = {
          clients: flowInput.clients || [],
          debts: (flowInput.debts || []).map(d => ({...d, dueDate: new Date(d.dueDate), paidDate: d.paidDate ? new Date(d.paidDate) : undefined })),
          summary: flowInput.summary || { totalPaidUSD: null, totalRemainingUSD: null, totalOutstandingDebtUSD: null },
          reportDate: reportDate,
      };
      const pdfBuffer = await generatePdfReport(pdfServiceInput);
      const excelBuffer = await generateExcelReport(pdfServiceInput);

      await sendEmail({
        to: recipientEmail,
        subject: subject,
        html: emailHtml,
        attachments: [
          {
            filename: `financial_report_${reportDate.toISOString().split('T')[0]}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
          {
            filename: `financial_report_${reportDate.toISOString().split('T')[0]}.xlsx`,
            content: excelBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      });

      console.log(`Daily report email sent successfully to ${recipientEmail}`);
      return { success: true, message: 'Daily report generated and sent successfully.' };

    } catch (error: any) {
      console.error('Error in dailyReportFlow:', error);
      try {
        await sendEmail({
          to: recipientEmail, // Send error to the intended recipient
          subject: `فشل إنشاء التقرير اليومي - ${reportDateStr}`,
          text: `حدث خطأ أثناء إنشاء أو إرسال تقريرك المالي اليومي:\n\n${error.message}\n\nيرجى التحقق من سجلات النظام.`,
        });
      } catch (emailError) {
        console.error('Failed to send error notification email:', emailError);
      }
      return { success: false, message: `Failed to process daily report: ${error.message}` };
    }
  }
);
