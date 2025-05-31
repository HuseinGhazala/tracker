
/**
 * @fileOverview Defines Zod schemas and TypeScript types for the daily report flow.
 */

import { z } from 'genkit';

// Input schema for the data required by the report generation *function*.
// The flow itself might receive different/less structured input initially.
export const DailyReportInputSchema = z.object({
  clients: z.array(z.any()).optional().describe("List of client data."),
  debts: z.array(z.any()).optional().describe("List of debt data."),
  appointments: z.array(z.any()).optional().describe("List of appointment data."),
  tasks: z.array(z.any()).optional().describe("List of task data."),
  expenses: z.array(z.any()).optional().describe("List of expense data."), // Added expenses
  summary: z.object({
      totalPaidUSD: z.number().nullable(),
      totalRemainingUSD: z.number().nullable(),
      totalOutstandingDebtUSD: z.number().nullable(),
      totalExpensesUSD: z.number().nullable(), // Added totalExpensesUSD
      zakatAmountEGP: z.number().nullable(),
  }).optional().describe("Summary financial data."),
  reportDate: z.string().datetime().optional().describe("The date the report is generated for (ISO 8601 format)."),
  recipientEmail: z.string().email().optional().describe("The email address to send the report to."),
  daysRemainingInYear: z.number().optional().describe("Number of days remaining in the current year."),
  htmlChart: z.string().optional().describe("HTML string for the cumulative income chart to be embedded in the email."),
});
export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;


// Output schema indicating success or failure of the report sending process.
export const DailyReportOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

