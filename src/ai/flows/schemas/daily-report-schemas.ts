
/**
 * @fileOverview Defines Zod schemas and TypeScript types for the daily report flow.
 */

import { z } from 'genkit';

// Input schema for the data required by the report generation *function*.
// The flow itself might receive different/less structured input initially.
export const DailyReportInputSchema = z.object({
  clients: z.array(z.any()).optional().describe("List of client data."), // Optional: Data might be fetched within the trigger function
  debts: z.array(z.any()).optional().describe("List of debt data."),     // Optional: Data might be fetched within the trigger function
  summary: z.object({
      totalPaidUSD: z.number().nullable(),
      totalRemainingUSD: z.number().nullable(),
      totalOutstandingDebtUSD: z.number().nullable(),
  }).optional().describe("Summary financial data."), // Optional: Summary might be calculated
  reportDate: z.string().datetime().optional().describe("The date the report is generated for (ISO 8601 format)."), // Optional: Defaults to now
});
export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;


// Output schema indicating success or failure of the report sending process.
export const DailyReportOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;
