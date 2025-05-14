
'use server';
/**
 * @fileOverview A financial analysis AI agent.
 *
 * - analyzeFinancials - A function that handles the financial analysis process using an LLM.
 * - FinancialAnalysisInput - The input type for the analyzeFinancials function.
 * - FinancialAnalysisOutput - The return type for the analyzeFinancials function.
 */

import { ai } from '@/ai/ai-instance';
import type { FinancialAnalysisInput, FinancialAnalysisOutput } from './schemas/financial-analysis-schemas';
import { FinancialAnalysisInputSchema, FinancialAnalysisOutputSchema } from './schemas/financial-analysis-schemas';

export async function analyzeFinancials(input: FinancialAnalysisInput): Promise<FinancialAnalysisOutput> {
  const result = await financialAnalysisFlow(input);
  if (!result) {
    throw new Error('Financial analysis flow did not return a result.');
  }
  return result;
}

const financialAnalysisPrompt = ai.definePrompt({
  name: 'financialAnalysisPrompt',
  input: { schema: FinancialAnalysisInputSchema },
  output: { schema: FinancialAnalysisOutputSchema },
  prompt: `You are an expert financial analyst AI. Your task is to analyze the provided monthly financial summaries for a small business or freelancer.
The user is currently focusing on the month: {{currentMonthFocus.year}}-{{String(currentMonthFocus.month).padStart(2,'0')}}. (Month is 1-indexed, e.g., 1 for January)

Here is the historical data available (all monetary values are in USD):
{{#if allMonthlySummaries.length}}
{{#each allMonthlySummaries}}
- Year: {{this.year}}, Month: {{String(this.month).padStart(2,'0')}}
  - Total Income: {{this.totalIncomeUSD}}
  {{#if this.numberOfClients}} - Active Clients: {{this.numberOfClients}}{{else}} - Active Clients: Not specified{{/if}}
  {{#if this.numberOfProjects}} - Unique Projects (from paying clients): {{this.numberOfProjects}}{{else}} - Unique Projects: Not specified{{/if}}
{{/each}}
{{else}}
No historical data provided. The analysis will be limited.
{{/if}}

{{#if analysisContext}}
The user has provided the following specific context or question for the analysis:
"{{{analysisContext}}}"
Please address this context in your analysis.
{{/if}}

Based on this data, please provide a comprehensive financial analysis. Structure your response according to the following fields, ensuring all monetary values in your analysis are also in USD and clearly labeled with '$' and two decimal places (e.g., $1,234.56):
1.  **overallAssessment**: A general assessment of the financial health and trends observed from all available data.
2.  **currentMonthPerformance**: A specific analysis of the performance for {{currentMonthFocus.year}}-{{String(currentMonthFocus.month).padStart(2,'0')}}.
3.  **comparativeAnalysis**: Compare {{currentMonthFocus.year}}-{{String(currentMonthFocus.month).padStart(2,'0')}} with previous periods (e.g., the immediately preceding month, the average of previous months, or the same month in the previous year if data is available). Highlight percentage changes where significant (e.g., "X% higher/lower").
4.  **keyTrends**: Identify and list 2-4 key financial trends. These could be patterns in income, client acquisition, project load, etc.
5.  **potentialFocusAreas** (Optional): If applicable, suggest 1-2 areas that might need attention or could be opportunities for improvement based on the data.

Keep your analysis concise, clear, and data-driven. Use professional but understandable language.
If data is insufficient for a particular type of analysis (e.g., year-over-year comparison due to lack of data), state that clearly.
Return the analysis in the specified JSON output format.
`,
  // Register a Handlebars helper for padStart
  handlebars: {
    helpers: {
      String: (value: any) => String(value), // Make String constructor available
      // padStart is tricky with Handlebars' default capabilities.
      // It's often better to pre-format such values before sending to the prompt,
      // or rely on the LLM to understand "Month: 1" as January.
      // Forcing LLM: "When referring to months, use MM format e.g. January is 01"
    }
  }
});

const financialAnalysisFlow = ai.defineFlow(
  {
    name: 'financialAnalysisFlow',
    inputSchema: FinancialAnalysisInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input) => {
    // The padStart helper might not work as expected in all Genkit Handlebars environments.
    // LLMs are generally good at understanding "month: 1" means January for "YYYY-MM" formatting.
    // The prompt instructs the LLM on the 1-indexed month.

    const { output } = await financialAnalysisPrompt(input);
    if (!output) {
      throw new Error('No output from financial analysis prompt.');
    }
    return output;
  }
);
