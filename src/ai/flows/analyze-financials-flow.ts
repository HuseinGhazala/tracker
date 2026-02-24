
'use server';
/**
 * @fileOverview A financial analysis AI agent that considers income and expenses.
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
  model: 'gemini-1.5-flash-latest',
  prompt: `أنت خبير تحليل مالي يعمل بالذكاء الاصطناعي. مهمتك هي تحليل ملخصات مالية شهرية (تشمل الدخل والمصروفات) مقدمة لشركة صغيرة أو مستقل.
يركز المستخدم حاليًا على الشهر: {{currentMonthFocus.year}}-{{currentMonthFocus.month}}. (الشهر مُقدم بصيغة MM المكونة من رقمين، على سبيل المثال، 01 لشهر يناير). عند الإشارة إلى الأشهر بتنسيق YYYY-MM، يرجى التأكد دائمًا من تمثيل الشهر برقمين.

الرجاء تقديم جميع الردود باللغة العربية الفصحى.

إليك البيانات التاريخية المتاحة (جميع القيم النقدية بالدولار الأمريكي):
{{#if allMonthlySummaries.length}}
{{#each allMonthlySummaries}}
- السنة: {{this.year}}، الشهر: {{this.month}}
  - إجمالي الدخل: {{this.totalIncomeUSD}}
  {{#if this.totalExpensesUSD}} - إجمالي المصروفات: {{this.totalExpensesUSD}}{{else}} - إجمالي المصروفات: غير محدد{{/if}}
  {{#if this.numberOfClients}} - عدد العملاء النشطين: {{this.numberOfClients}}{{else}} - عدد العملاء النشطين: غير محدد{{/if}}
  {{#if this.numberOfProjects}} - عدد المشاريع الفريدة (من العملاء الذين دفعوا): {{this.numberOfProjects}}{{else}} - عدد المشاريع الفريدة: غير محدد{{/if}}
{{/each}}
{{else}}
لا توجد بيانات تاريخية مقدمة. سيكون التحليل محدودًا.
{{/if}}

{{#if analysisContext}}
قدم المستخدم السياق أو السؤال المحدد التالي للتحليل:
"{{{analysisContext}}}"
يرجى معالجة هذا السياق في تحليلك.
{{/if}}

بناءً على هذه البيانات، يرجى تقديم تحليل مالي شامل للدخل والمصروفات. قم بتنظيم ردك وفقًا للحقول التالية، مع التأكد من أن جميع القيم النقدية في تحليلك بالدولار الأمريكي أيضًا ومُعلمة بوضوح بـ '$' ومنزلتين عشريتين (على سبيل المثال، $1,234.56):
1.  **overallAssessment_ar**: تقييم عام للصحة المالية (الدخل والمصروفات) والاتجاهات المرصودة من جميع البيانات المتاحة (باللغة العربية).
2.  **currentMonthPerformance_ar**: تحليل محدد لأداء الشهر {{currentMonthFocus.year}}-{{currentMonthFocus.month}} (يشمل الدخل، المصروفات، وصافي الربح/الخسارة إذا أمكن) (باللغة العربية).
3.  **comparativeAnalysis_ar**: قارن {{currentMonthFocus.year}}-{{currentMonthFocus.month}} (الدخل والمصروفات) بالفترات السابقة (على سبيل المثال، الشهر السابق مباشرة، متوسط الأشهر السابقة، أو نفس الشهر في العام السابق إذا كانت البيانات متاحة). سلط الضوء على التغييرات المئوية حيثما كانت مهمة (باللغة العربية).
4.  **keyTrends_ar**: حدد وقائمة 2-4 اتجاهات مالية رئيسية (تشمل أنماط الدخل والمصروفات). (قائمة بالسلاسل النصية باللغة العربية).
5.  **potentialFocusAreas_ar** (اختياري): إذا كان ذلك ممكنًا، اقترح 1-2 مجالات قد تحتاج إلى اهتمام أو يمكن أن تكون فرصًا للتحسين بناءً على تحليل الدخل والمصروفات (قائمة بالسلاسل النصية باللغة العربية).

حافظ على تحليلك موجزًا وواضحًا وقائمًا على البيانات. استخدم لغة احترافية ولكن مفهومة.
إذا كانت البيانات غير كافية لنوع معين من التحليل، اذكر ذلك بوضوح.
أرجع التحليل بتنسيق JSON المحدد باللغة العربية.
`,
});

const financialAnalysisFlow = ai.defineFlow(
  {
    name: 'financialAnalysisFlow',
    inputSchema: FinancialAnalysisInputSchema,
    outputSchema: FinancialAnalysisOutputSchema,
  },
  async (input) => {
    // Input month is now expected to be a pre-formatted MM string.
    const { output } = await financialAnalysisPrompt(input);
    if (!output) {
      throw new Error('No output from financial analysis prompt.');
    }
    return output;
  }
);
