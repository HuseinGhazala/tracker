
'use server';
/**
 * @fileOverview Defines a Genkit flow to generate and send a daily financial report.
 *
 * - sendDailyReport - Triggers the report generation and emailing process.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmail } from '@/services/email-service'; // Placeholder email service
import { generatePdfReport } from '@/services/pdf-service'; // Placeholder PDF service
import type { DailyReportInput, DailyReportOutput } from './schemas/daily-report-schemas'; // Import types
import { DailyReportInputSchema, DailyReportOutputSchema } from './schemas/daily-report-schemas'; // Import schemas


// This function will be called (e.g., by a scheduled job or manually)
export async function sendDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
    // In a real scenario, you might fetch the actual client/debt data here
    // For now, we'll pass placeholder data to the flow
    const placeholderData = {
        clients: input.clients ?? [], // Use passed clients or default to empty array
        debts: input.debts ?? [],     // Use passed debts or default to empty array
        summary: {
            totalPaidUSD: input.summary?.totalPaidUSD ?? null,
            totalRemainingUSD: input.summary?.totalRemainingUSD ?? null,
            totalOutstandingDebtUSD: input.summary?.totalOutstandingDebtUSD ?? null,
        },
        reportDate: input.reportDate ?? new Date(),
    };

    try {
        // Pass necessary data to the flow
        const result = await dailyReportFlow(placeholderData);
        return result;
    } catch (error: any) {
        console.error("Error executing dailyReportFlow:", error);
        return { success: false, message: `Flow execution failed: ${error.message}` };
    }
}

// Define the Genkit flow
const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    // Input schema receives the data needed for the report
    // Use the imported schema
    inputSchema: z.object({
        clients: z.array(z.any()).describe("List of client data."), // Use specific client schema if available
        debts: z.array(z.any()).describe("List of debt data."),     // Use specific debt schema if available
        summary: z.object({
            totalPaidUSD: z.number().nullable(),
            totalRemainingUSD: z.number().nullable(),
            totalOutstandingDebtUSD: z.number().nullable(),
        }).describe("Summary financial data."),
        reportDate: z.date().describe("The date the report is generated for."),
    }),
    // Use the imported schema
    outputSchema: DailyReportOutputSchema,
  },
  async (reportData) => {
    const recipientEmail = 'husseinghazala39@gmail.com'; // Hardcoded recipient email
    const reportDateStr = reportData.reportDate.toLocaleDateString('ar-SA', { dateStyle: 'full' });
    const subject = `تقريرك المالي اليومي - ${reportDateStr}`;

    try {
      // 1. Generate PDF Report using the service
      const pdfBuffer = await generatePdfReport(reportData);

      // 2. Prepare Email Content (Simple text for now)
      // You could use another Genkit prompt here to generate a summary text based on the data
      const emailText = `
مرحبًا،

مرفق طيه تقريرك المالي لليوم ${reportDateStr}.

ملخص سريع:
- إجمالي المدفوعات (المقدر بالدولار): ${reportData.summary.totalPaidUSD?.toFixed(2) ?? 'N/A'}
- إجمالي المبالغ المتبقية من العملاء (المقدر بالدولار): ${reportData.summary.totalRemainingUSD?.toFixed(2) ?? 'N/A'}
- إجمالي الديون المستحقة (المقدر بالدولار): ${reportData.summary.totalOutstandingDebtUSD?.toFixed(2) ?? 'N/A'}

يرجى مراجعة الملف المرفق للحصول على التفاصيل الكاملة.

مع تحيات،
نظام التتبع المالي
      `;

      // 3. Send Email using the service
      await sendEmail({
        to: recipientEmail,
        subject: subject,
        text: emailText,
        attachments: [
          {
            filename: `financial_report_${reportData.reportDate.toISOString().split('T')[0]}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      console.log(`Daily report email sent successfully to ${recipientEmail}`);
      return { success: true, message: 'Daily report generated and sent successfully.' };

    } catch (error: any) {
      console.error('Error in dailyReportFlow:', error);
      // Attempt to send a failure notification email (optional)
      try {
        await sendEmail({
          to: recipientEmail,
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

// Note: This flow needs to be triggered.
// In a real application, you might set up a scheduled task (e.g., using Cloud Scheduler or cron)
// that calls the `sendDailyReport(...)` function once a day.
// Or, provide a button in the UI to trigger it manually.

// Example of manual trigger (could be placed in a component or API route):
// async function handleManualTrigger() {
//   // Prepare the input data for the report
//   const inputData = { /* fetch or construct clients, debts, summary, reportDate */ };
//   const result = await sendDailyReport(inputData);
//   console.log('Manual report trigger result:', result);
// }
