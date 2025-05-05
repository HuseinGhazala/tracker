
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
// Note: It now receives input matching DailyReportInput, including reportDate as an optional string
export async function sendDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
    // Prepare data ensuring reportDate is a string (ISO format)
    const flowInputData: z.infer<typeof DailyReportInputSchema> = {
        clients: input.clients ?? [],
        debts: input.debts ?? [],
        summary: {
            totalPaidUSD: input.summary?.totalPaidUSD ?? null,
            totalRemainingUSD: input.summary?.totalRemainingUSD ?? null,
            totalOutstandingDebtUSD: input.summary?.totalOutstandingDebtUSD ?? null,
        },
        // Ensure reportDate is a string (ISO format), default to now if not provided
        reportDate: input.reportDate ?? new Date().toISOString(),
    };

    try {
        // Pass the validated string date to the flow
        const result = await dailyReportFlow(flowInputData);
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
    // Use the imported schema which now expects reportDate as string|undefined
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (reportData) => {
    // reportData.reportDate is now a string (ISO format) or undefined
    const reportDate = reportData.reportDate ? new Date(reportData.reportDate) : new Date(); // Parse string back to Date

    const recipientEmail = 'husseinghazala39@gmail.com'; // Hardcoded recipient email
    const reportDateStr = reportDate.toLocaleDateString('ar-SA', { dateStyle: 'full' });
    const subject = `تقريرك المالي اليومي - ${reportDateStr}`;

    try {
      // 1. Generate PDF Report using the service - Pass the Date object
       const pdfData = { ...reportData, reportDate }; // Pass Date object to PDF service
      const pdfBuffer = await generatePdfReport(pdfData);


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
            filename: `financial_report_${reportDate.toISOString().split('T')[0]}.pdf`,
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
//   const inputData = {
//     clients: [/* client data */],
//     debts: [/* debt data */],
//     summary: { /* summary data */ },
//     reportDate: new Date().toISOString(), // Ensure date is ISO string
//   };
//   const result = await sendDailyReport(inputData);
//   console.log('Manual report trigger result:', result);
// }
