
/**
 * @fileOverview Defines Zod schemas and TypeScript types for the financial analysis flow.
 *
 * - MonthlySummarySchema - Schema for individual monthly financial data.
 * - FinancialAnalysisInputSchema - Input schema for the financial analysis flow.
 * - FinancialAnalysisOutputSchema - Output schema for the financial analysis flow.
 */

import { z } from 'genkit';

export const MonthlySummarySchema = z.object({
  year: z.number().describe("سنة الملخص."),
  month: z.string().length(2).regex(/^(0[1-9]|1[0-2])$/, "يجب أن يكون الشهر مكونًا من رقمين (01-12).").describe("شهر الملخص (بصيغة 'MM'، مثال: '01' ليناير، '12' لديسمبر)."),
  totalIncomeUSD: z.number().describe("إجمالي الدخل بالدولار الأمريكي للشهر."),
  numberOfClients: z.number().optional().describe("عدد العملاء النشطين الذين قاموا بالدفع خلال الشهر."),
  numberOfProjects: z.number().optional().describe("عدد المشاريع الفريدة المرتبطة بالعملاء الذين قاموا بالدفع خلال الشهر."),
});
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;

export const FinancialAnalysisInputSchema = z.object({
  allMonthlySummaries: z.array(MonthlySummarySchema).describe("مصفوفة من الملخصات المالية لجميع الأشهر المتاحة. تأكد من فرز الأشهر ترتيبًا زمنيًا إذا أمكن."),
  currentMonthFocus: z.object({
    year: z.number(),
    month: z.string().length(2).regex(/^(0[1-9]|1[0-2])$/, "يجب أن يكون الشهر مكونًا من رقمين (01-12)."),
  }).describe("الشهر المحدد (السنة والشهر بصيغة 'MM') الذي يعرضه المستخدم حاليًا أو يريد تركيز التحليل عليه."),
  analysisContext: z.string().optional().describe("سياق اختياري مقدم من المستخدم أو أسئلة محددة للتحليل، على سبيل المثال، 'ركز على النمو مقارنة بالربع الأخير'.")
});
export type FinancialAnalysisInput = z.infer<typeof FinancialAnalysisInputSchema>;

export const FinancialAnalysisOutputSchema = z.object({
  overallAssessment_ar: z.string().describe("تقييم عام للصحة المالية والاتجاهات المرصودة من جميع البيانات المتاحة (باللغة العربية). مثال: 'تبدو الصحة المالية العامة مستقرة مع اتجاه تصاعدي طفيف في الدخل خلال العام الماضي.'"),
  currentMonthPerformance_ar: z.string().describe("تحليل محدد لأداء الشهر الحالي (باللغة العربية). مثال: 'بلغ الدخل لشهر YYYY-MM مبلغ X دولار، مما يمثل زيادة بنسبة Y% عن الشهر السابق.'"),
  comparativeAnalysis_ar: z.string().describe("مقارنة الشهر الحالي بالفترات السابقة (مثل الشهر الماضي، نفس الشهر من العام الماضي إذا سمحت البيانات) (باللغة العربية). مثال: 'مقارنة بشهر MM-YYYY، ارتفع الدخل بنسبة Z%. بلغ متوسط الدخل الشهري للأشهر الستة الماضية W دولار.'"),
  keyTrends_ar: z.array(z.string()).describe("قائمة بالاتجاهات المالية الرئيسية المحددة (باللغة العربية) (مثال: ['زاد الدخل بنسبة X% خلال الأشهر الثلاثة الماضية.'، 'كان معدل اكتساب العملاء ثابتًا.'])."),
  potentialFocusAreas_ar: z.array(z.string()).optional().describe("اقتراحات للمجالات التي قد تحتاج إلى اهتمام أو تحقيق بناءً على البيانات (باللغة العربية). مثال: ['تحقق من الانخفاض الطفيف في عدد المشاريع هذا الشهر على الرغم من ثبات أعداد العملاء.']"),
});
export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;
