
/**
 * @fileOverview Defines Zod schemas and TypeScript types for the financial analysis flow.
 *
 * - MonthlySummarySchema - Schema for individual monthly financial data.
 * - FinancialAnalysisInputSchema - Input schema for the financial analysis flow.
 * - FinancialAnalysisOutputSchema - Output schema for the financial analysis flow.
 */

import { z } from 'genkit';

export const MonthlySummarySchema = z.object({
  year: z.number().describe("The year of the summary."),
  month: z.number().min(1).max(12).describe("The month of the summary (1 for January, 12 for December)."),
  totalIncomeUSD: z.number().describe("Total income in USD for the month."),
  numberOfClients: z.number().optional().describe("Number of active clients who made payments during the month."),
  numberOfProjects: z.number().optional().describe("Number of unique projects associated with clients who made payments during the month."),
});
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;

export const FinancialAnalysisInputSchema = z.object({
  allMonthlySummaries: z.array(MonthlySummarySchema).describe("An array of financial summaries for all available months. Ensure months are chronologically sorted if possible."),
  currentMonthFocus: z.object({
    year: z.number(),
    month: z.number().min(1).max(12),
  }).describe("The specific month (year and 1-indexed month number) the user is currently viewing or wants to focus the analysis on."),
  analysisContext: z.string().optional().describe("Optional user-provided context or specific questions for the analysis, e.g., 'Focus on growth compared to last quarter'.")
});
export type FinancialAnalysisInput = z.infer<typeof FinancialAnalysisInputSchema>;

export const FinancialAnalysisOutputSchema = z.object({
  overallAssessment: z.string().describe("A general assessment of the financial health and trends observed from all available data. Example: 'Overall financial health appears stable with a slight upward trend in income over the past year.'"),
  currentMonthPerformance: z.string().describe("Specific analysis of the current month's performance. Example: 'Income for YYYY-MM was $X, representing a Y% increase from the previous month.'"),
  comparativeAnalysis: z.string().describe("Comparison of the current month with previous periods (e.g., last month, same month last year if data allows). Example: 'Compared to MM-YYYY, income is up by Z%. Average monthly income for the past 6 months was $W.'"),
  keyTrends: z.array(z.string()).describe("List of key financial trends identified (e.g., ['Income increased by X% over the last 3 months.', 'Client acquisition rate has been steady.'])."),
  potentialFocusAreas: z.array(z.string()).optional().describe("Suggestions for areas that might need attention or investigation based on the data. Example: ['Investigate the slight dip in project count this month despite consistent client numbers.']"),
});
export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;

