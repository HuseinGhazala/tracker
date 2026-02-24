'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea
} from '@/components/ui';
import { Loader2, Send, BarChartBig, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendDailyReport } from '@/ai/flows/send-daily-report-flow';
import { analyzeFinancials } from '@/ai/flows/analyze-financials-flow';
import type { FinancialAnalysisInput, FinancialAnalysisOutput, MonthlySummary } from '@/ai/flows/schemas/financial-analysis-schemas';
import { endOfYear, differenceInDays } from 'date-fns';

const emailReportSchema = z.object({
  recipientEmail: z.string().email('الرجاء إدخال بريد إلكتروني صحيح.'),
});

type EmailReportFormData = z.infer<typeof emailReportSchema>;

const ReportsPage = () => {
  const firestore = useFirestore();
  const { data: user } = useUser();
  const { toast } = useToast();
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FinancialAnalysisOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const emailForm = useForm<EmailReportFormData>({
    resolver: zodResolver(emailReportSchema),
    defaultValues: {
      recipientEmail: user?.email ?? '',
    },
  });

  const clientsQuery = useMemo(() => user && firestore ? collection(firestore, `users/${user.uid}/clients`) : null, [firestore, user]);
  const { data: clients } = useCollection(clientsQuery, { listen: true, idField: 'id' });

  const debtsQuery = useMemo(() => user && firestore ? collection(firestore, `users/${user.uid}/debts`) : null, [firestore, user]);
  const { data: debts } = useCollection(debtsQuery, { listen: true, idField: 'id' });

  const expensesQuery = useMemo(() => user && firestore ? collection(firestore, `users/${user.uid}/expenses`) : null, [firestore, user]);
  const { data: expenses } = useCollection(expensesQuery, { listen: true, idField: 'id' });
  
  const paymentsQuery = useMemo(() => user && firestore ? collection(firestore, `users/${user.uid}/payments`) : null, [firestore, user]);
  const { data: payments } = useCollection(paymentsQuery, { listen: true, idField: 'id' });


  const onSendReport = async (data: EmailReportFormData) => {
    setIsSendingReport(true);
    toast({ title: 'جاري إرسال التقرير...' });
    
    // This is a simplified data preparation logic. A real app would have more complex aggregations.
    const today = new Date();
    const summary = {
        totalPaidUSD: clients?.reduce((sum, c) => sum + (c.totalPaid || 0), 0) ?? 0,
        totalRemainingUSD: clients?.reduce((sum, c) => sum + (c.totalProjectCost - (c.totalPaid || 0)), 0) ?? 0,
        totalOutstandingDebtUSD: debts?.reduce((sum, d) => sum + (d.status !== 'paid' ? d.amount - (d.amountRepaid || 0) : 0), 0) ?? 0,
        totalExpensesUSD: expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0,
        zakatAmountEGP: 0, // Placeholder
    }

    try {
      await sendDailyReport({
        clients: clients ?? [],
        debts: debts ?? [],
        expenses: expenses ?? [],
        summary: summary,
        reportDate: today.toISOString(),
        recipientEmail: data.recipientEmail,
        daysRemainingInYear: differenceInDays(endOfYear(today), today),
        htmlChart: '<p>Chart placeholder</p>',
      });
      toast({ title: 'تم إرسال التقرير بنجاح!' });
    } catch (error: any) {
      toast({ title: 'فشل إرسال التقرير', description: error.message, variant: 'destructive' });
    } finally {
      setIsSendingReport(false);
    }
  };

  const onAnalyzeFinancials = useCallback(async () => {
    if (!payments || !expenses || !clients) {
        toast({ title: 'لا توجد بيانات كافية للتحليل', variant: 'destructive'});
        return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    toast({ title: 'جاري تحليل البيانات...' });

    try {
        const monthlyMap: Record<string, Partial<MonthlySummary> & { year: number, month: string }> = {};

        const processItems = (items: any[], dateField: string, amountField: string, isIncome: boolean) => {
            items.forEach(item => {
                const date = item[dateField]?.toDate();
                if (!date) return;
                const year = date.getFullYear();
                const monthStr = String(date.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${monthStr}`;
                if (!monthlyMap[key]) {
                    monthlyMap[key] = { year, month: monthStr, totalIncomeUSD: 0, totalExpensesUSD: 0, numberOfClients: 0, numberOfProjects: 0 };
                }
                // Simplified: assumes all currencies are USD for now
                if (isIncome) {
                    monthlyMap[key].totalIncomeUSD! += item[amountField];
                } else {
                    monthlyMap[key].totalExpensesUSD! += item[amountField];
                }
            });
        };
        
        processItems(payments, 'paymentDate', 'amount', true);
        processItems(expenses, 'expenseDate', 'amount', false);

        const allMonthlySummaries = Object.values(monthlyMap) as MonthlySummary[];
        
        const input: FinancialAnalysisInput = {
            allMonthlySummaries,
            currentMonthFocus: { year: new Date().getFullYear(), month: String(new Date().getMonth() + 1).padStart(2, '0')},
        };

        const result = await analyzeFinancials(input);
        setAnalysisResult(result);
        toast({ title: 'اكتمل التحليل بنجاح!'});

    } catch (error: any) {
        setAnalysisError(error.message);
        toast({ title: 'فشل التحليل المالي', description: error.message, variant: 'destructive' });
    } finally {
        setIsAnalyzing(false);
    }
  }, [payments, expenses, clients, toast]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>إرسال التقرير اليومي</CardTitle>
          <CardDescription>إرسال ملخص مالي يومي إلى بريدك الإلكتروني.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onSendReport)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="recipientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني للمستلم</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSendingReport}>
                {isSendingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                إرسال التقرير
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-6 w-6 text-primary"/>التحليل المالي بالذكاء الاصطناعي</CardTitle>
              <CardDescription>احصل على رؤى تفصيلية حول أدائك المالي.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="space-y-4">
                  <Button onClick={onAnalyzeFinancials} disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChartBig className="mr-2 h-4 w-4" />}
                      تحليل البيانات المالية
                  </Button>

                  {isAnalyzing && <p className="text-muted-foreground">جاري التحليل، قد يستغرق الأمر بضع لحظات...</p>}
                  
                  {analysisError && <p className="text-destructive">خطأ: {analysisError}</p>}
                  
                  {analysisResult && (
                      <div className="space-y-4 prose prose-sm dark:prose-invert max-w-none">
                          <div>
                              <h3>التقييم العام</h3>
                              <p>{analysisResult.overallAssessment_ar}</p>
                          </div>
                          <div>
                              <h3>أداء الشهر الحالي</h3>
                              <p>{analysisResult.currentMonthPerformance_ar}</p>
                          </div>
                          <div>
                              <h3>تحليل مقارن</h3>
                              <p>{analysisResult.comparativeAnalysis_ar}</p>
                          </div>
                          <div>
                              <h3>اتجاهات رئيسية</h3>
                              <ul>
                                  {analysisResult.keyTrends_ar.map((trend, i) => <li key={i}>{trend}</li>)}
                              </ul>
                          </div>
                          {analysisResult.potentialFocusAreas_ar && (
                            <div>
                                <h3>نقاط للتركيز</h3>
                                <ul>
                                    {analysisResult.potentialFocusAreas_ar.map((area, i) => <li key={i}>{area}</li>)}
                                </ul>
                            </div>
                          )}
                      </div>
                  )}
              </div>
          </CardContent>
      </Card>

    </div>
  );
};

export default ReportsPage;
