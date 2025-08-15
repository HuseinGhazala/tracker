

'use client';

import * as React from 'react';
import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, startOfMonth as dateFnsStartOfMonth, endOfMonth as dateFnsEndOfMonth, addDays, endOfYear, differenceInDays, addMonths, subMonths, getYear, getMonth, parseISO } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { CalendarIcon, ArrowUpDown, Trash2, Loader2, AlertCircle, Edit, Send, Coins, Clock, CalendarDays, PlusCircle, ListFilter, RefreshCw, BarChartBig, Brain, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ClientPaymentChart, type CumulativeChartData } from '@/components/client-payment-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeDisplay } from '@/components/date-time-display';
import { MonthNavigation } from '@/components/month-navigation';


import { sendDailyReport } from '@/ai/flows/send-daily-report-flow';
import type { DailyReportInput } from '@/ai/flows/schemas/daily-report-schemas';

import { analyzeFinancials } from '@/ai/flows/analyze-financials-flow';
import type { FinancialAnalysisInput, FinancialAnalysisOutput, MonthlySummary } from '@/ai/flows/schemas/financial-analysis-schemas';


const PAYMENT_STATUSES = {
  paid: 'تم الدفع',
  partially_paid: 'دفع جزئي',
  not_paid: 'لم يتم الدفع',
} as const;
type PaymentStatus = keyof typeof PAYMENT_STATUSES;

const DEBT_STATUSES = {
  outstanding: 'مستحق',
  paid: 'تم السداد',
  partially_paid: 'سداد جزئي',
} as const;
type DebtStatus = keyof typeof DEBT_STATUSES;

const APPOINTMENT_STATUSES = {
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  rescheduled: 'معاد جدولته',
} as const;
type AppointmentStatus = keyof typeof APPOINTMENT_STATUSES;

const TASK_STATUSES = {
  todo: 'قيد التنفيذ',
  in_progress: 'جاري العمل عليها',
  completed: 'مكتملة',
  on_hold: 'معلقة',
} as const;
type TaskStatus = keyof typeof TASK_STATUSES;


const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;
export type Currency = keyof typeof CURRENCIES;

const EXPENSE_CATEGORIES = {
    food: 'طعام وشراب',
    transport: 'مواصلات',
    housing: 'سكن ومعيشة',
    bills: 'فواتير وخدمات',
    health: 'صحة وعلاج',
    education: 'تعليم وتطوير',
    entertainment: 'ترفيه وتسوق',
    personal: 'عناية شخصية',
    charity: 'صدقات وتبرعات',
    other: 'مصروفات أخرى',
} as const;
type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;


const ZAKAT_RATE = 0.025;

const paymentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  amount: z.coerce.number().positive({ message: 'مبلغ الدفعة يجب أن يكون رقمًا موجبًا.' }),
  paymentDate: z.date({ required_error: 'تاريخ الدفعة مطلوب.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'عملة الدفعة مطلوبة.' }),
});
type Payment = z.infer<typeof paymentSchema>;

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'اسم العميل مطلوب.' }),
  project: z.string().min(1, { message: 'وصف المشروع مطلوب.' }),
  totalProjectCost: z.coerce.number().positive({ message: 'يجب أن تكون التكلفة الإجمالية رقمًا موجبًا.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'العملة مطلوبة.' }),
  creationDate: z.date().optional(),
});
type Client = z.infer<typeof clientSchema>;

const debtSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, { message: 'وصف الدين مطلوب.' }),
  debtorName: z.string().min(1, { message: 'اسم المدين مطلوب.' }),
  creditorName: z.string().min(1, { message: 'اسم الدائن مطلوب.' }),
  amount: z.coerce.number().positive({ message: 'يجب أن يكون مبلغ الدين رقمًا موجبًا.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'العملة مطلوبة.' }),
  dueDate: z.date({ required_error: 'تاريخ الاستحقاق مطلوب.' }),
  status: z.enum(Object.keys(DEBT_STATUSES) as [DebtStatus, ...DebtStatus[]], { required_error: 'حالة الدين مطلوبة.' }),
  amountRepaid: z.coerce.number().nonnegative({ message: 'المبلغ المسدد يجب أن يكون صفر أو أكثر.' }).optional(),
  paidDate: z.date().optional(),
  notes: z.string().optional(),
  creationDate: z.date().optional(),
}).refine(data => {
  if ( (data.status === 'partially_paid' && (data.amountRepaid ?? 0) > 0 && !data.paidDate) || (data.status === 'paid' && !data.paidDate) ) {
    return false;
  }
  return true;
}, {
  message: 'تاريخ السداد مطلوب عندما تكون الحالة "تم السداد" أو "سداد جزئي" مع وجود مبلغ مسدد.',
  path: ['paidDate'],
}).refine(data => {
  if ( (data.status === 'paid') && (data.amountRepaid === undefined || data.amountRepaid === null) ) {
     return false;
  }
  return true;
}, {
  message: 'المبلغ المسدد مطلوب عندما تكون الحالة "تم السداد".',
  path: ['amountRepaid'],
}).refine(data => {
  if (data.amountRepaid !== undefined && data.amountRepaid !== null && data.amountRepaid > data.amount) {
    return false;
  }
  return true;
}, {
  message: 'المبلغ المسدد لا يمكن أن يتجاوز مبلغ الدين الإجمالي.',
  path: ['amountRepaid'],
}).refine(data => {
  if (data.status === 'paid' && data.amountRepaid !== data.amount) {
    return false;
  }
  return true;
}, {
  message: 'في حالة "تم السداد"، يجب أن يساوي المبلغ المسدد مبلغ الدين الإجمالي.',
  path: ['amountRepaid'],
}).refine(data => {
    if (data.status === 'outstanding' && (data.amountRepaid ?? 0) !== 0) {
        return false;
    }
    return true;
}, {
    message: 'في حالة "مستحق"، يجب أن يكون المبلغ المسدد صفر.',
    path: ['amountRepaid'],
});
type Debt = z.infer<typeof debtSchema>;

const appointmentSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, { message: "عنوان الموعد مطلوب." }),
    date: z.date({ required_error: "تاريخ الموعد مطلوب." }),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "صيغة الوقت غير صحيحة (HH:MM)." }),
    attendees: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(Object.keys(APPOINTMENT_STATUSES) as [AppointmentStatus, ...AppointmentStatus[]]),
    creationDate: z.date().optional(),
});
type Appointment = z.infer<typeof appointmentSchema>;

const taskSchema = z.object({
    id: z.string().optional(),
    description: z.string().min(1, { message: "وصف المهمة مطلوب." }),
    dueDate: z.date().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(Object.keys(TASK_STATUSES) as [TaskStatus, ...TaskStatus[]]),
    notes: z.string().optional(),
    creationDate: z.date().optional(),
});
type Task = z.infer<typeof taskSchema>;

const expenseSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, { message: 'وصف المصروف مطلوب.' }),
  amount: z.coerce.number().positive({ message: 'مبلغ المصروف يجب أن يكون رقمًا موجبًا.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'عملة المصروف مطلوبة.' }),
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]], { required_error: 'فئة المصروف مطلوبة.' }),
  expenseDate: z.date({ required_error: 'تاريخ المصروف مطلوب.' }),
  creationDate: z.date().optional(),
});
type Expense = z.infer<typeof expenseSchema>;

const paymentFormSchema = z.object({
  paymentAmount: z.coerce.number().positive({ message: 'مبلغ الدفعة يجب أن يكون أكبر من صفر.' }),
  paymentDate: z.date({ required_error: 'تاريخ الدفعة مطلوب.' }),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

const repaymentFormSchema = z.object({
    amountRepaid: z.coerce.number().nonnegative({ message: 'المبلغ المسدد يجب أن يكون صفر أو أكثر.' }),
    paidDate: z.date({ required_error: 'تاريخ آخر سداد مطلوب.' }),
});
type RepaymentFormData = z.infer<typeof repaymentFormSchema>;

const emailReportFormSchema = z.object({
  recipientEmail: z.string().email({ message: 'الرجاء إدخال عنوان بريد إلكتروني صحيح.' }),
});
type EmailReportFormData = z.infer<typeof emailReportFormSchema>;


const CLIENT_STORAGE_KEY = 'clientTrackerDataV4_Clients';
const PAYMENT_STORAGE_KEY = 'clientTrackerDataV4_Payments';
const DEBT_STORAGE_KEY = 'clientTrackerDataV4_Debts';
const APPOINTMENT_STORAGE_KEY = 'clientTrackerDataV1_Appointments';
const TASK_STORAGE_KEY = 'clientTrackerDataV1_Tasks';
const EXPENSE_STORAGE_KEY = 'clientTrackerDataV1_Expenses';
const SELECTED_DATE_STORAGE_KEY = 'clientTrackerSelectedDateV1';


const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
type ExchangeRates = {
    [key in Currency]?: number;
};

const calculateTotalPaid = (clientId: string, payments: Payment[], selectedMonth?: Date): number => {
  return payments
    .filter(p => {
        const paymentDate = p.paymentDate;
        const isInSelectedMonth = selectedMonth
            ? paymentDate.getFullYear() === selectedMonth.getFullYear() && paymentDate.getMonth() === selectedMonth.getMonth()
            : true;
        return p.clientId === clientId && isInSelectedMonth;
    })
    .reduce((sum, p) => sum + p.amount, 0);
};

const getLatestPaymentDate = (clientId: string, payments: Payment[]): Date | undefined => {
  const clientPayments = payments
    .filter(p => p.clientId === clientId)
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  return clientPayments.length > 0 ? clientPayments[0].paymentDate : undefined;
};

const determinePaymentStatus = (totalPaid: number, totalCost: number): PaymentStatus => {
    if (totalPaid <= 0) return 'not_paid';
    if (totalPaid >= totalCost) return 'paid';
    return 'partially_paid';
};

const formatCurrency = (amount: number | null | undefined, currency: Currency) => {
    if (amount === null || amount === undefined) return '-';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    };
    const locale = 'en-US';
    try {
        const displayAmount = Object.is(amount, -0) ? 0 : amount;
        return displayAmount.toLocaleString(locale, options);
    } catch (e) {
        console.warn(`Locale formatting failed for ${currency} with locale ${locale}:`, e);
        const symbols: { [key in Currency]: string } = { EGP: 'EGP', SAR: 'SAR', USD: '$', CAD: 'CA$', EUR: '€' };
        return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    }
};

const formatDateAr = (date: Date | null | undefined) => {
    if (!date || isNaN(date.getTime())) return '-';
    return format(date, 'PPP', { locale: arSA });
};
const formatDateEn = (date: Date | null | undefined) => {
    if (!date || isNaN(date.getTime())) return '-';
    return format(date, 'MMM d, yyyy', { locale: enUS });
};


const calculateClientRemainingAmount = (totalCost: number, totalPaid: number): number => {
    return Math.max(0, totalCost - totalPaid);
};

const calculateDebtRemainingAmount = (debt: Partial<Debt>): number => {
    if (!debt.amount || debt.amount <= 0) return 0;
    if (debt.status === 'paid') return 0;
    const repaid = debt.amountRepaid ?? 0;
    return Math.max(0, debt.amount - repaid);
};


const UsdToEgpRateDisplay: FC<{ rates: ExchangeRates | null }> = ({ rates }) => {
  if (!rates || !rates.EGP) {
    return (
      <Card className="mb-4 shadow-sm overflow-hidden bg-secondary text-secondary-foreground">
        <CardContent className="p-3 text-center">
          <span className="text-muted-foreground">سعر صرف الجنيه المصري غير متاح حاليًا.</span>
        </CardContent>
      </Card>
    );
  }

  const egpRate = rates.EGP;

  return (
    <Card className="mb-4 shadow-sm overflow-hidden bg-secondary text-secondary-foreground">
      <CardContent className="p-3 text-center">
        <div>
          <span className="font-semibold">1 دولار أمريكي</span> = <span className="font-semibold">{egpRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span> <span className="font-semibold">{CURRENCIES.EGP}</span>
        </div>
      </CardContent>
    </Card>
  );
};


const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [clientSortConfig, setClientSortConfig] = useState<{ key: keyof Client | 'derivedStatus' | 'derivedAmountPaid' | 'derivedRemainingAmount' | 'derivedPaymentDate' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const [debtSortConfig, setDebtSortConfig] = useState<{ key: keyof Debt | 'remainingDebt' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const [appointmentSortConfig, setAppointmentSortConfig] = useState<{ key: keyof Appointment | null; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'ascending' });
  const [taskSortConfig, setTaskSortConfig] = useState<{ key: keyof Task | null; direction: 'ascending' | 'descending' }>({ key: 'dueDate', direction: 'ascending' });
  const [expenseSortConfig, setExpenseSortConfig] = useState<{ key: keyof Expense | null; direction: 'ascending' | 'descending' }>({ key: 'expenseDate', direction: 'descending' });


  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState<string | null>(null);

  const [addingPaymentForClientId, setAddingPaymentForClientId] = useState<string | null>(null);
  const [editingRepaymentForDebtId, setEditingRepaymentForDebtId] = useState<string | null>(null);
  const [isSendingReport, setIsSendingReport] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [isAnalyzingFinancials, setIsAnalyzingFinancials] = useState(false);
  const [financialAnalysisResult, setFinancialAnalysisResult] = useState<FinancialAnalysisOutput | null>(null);
  const [financialAnalysisError, setFinancialAnalysisError] = useState<string | null>(null);

  const toastQueueRef = useRef<Parameters<typeof toast>[]>([]);
  const showToast = useCallback((props: Parameters<typeof toast>[0]) => {
      if (typeof window !== 'undefined') {
          if (!isMounted) {
            toastQueueRef.current.push([props]);
            return;
          }
          toast(props);
      }
  }, [toast, isMounted]);

  useEffect(() => {
    if (isMounted) {
      toastQueueRef.current.forEach(args => toast(...args));
      toastQueueRef.current = [];
    }
  }, [isMounted, toast]);


  useEffect(() => {
    const fetchRates = async () => {
      setRateLoading(true);
      setRateError(null);
      try {
        const response = await fetch(EXCHANGE_RATE_API_URL);
        if (!response.ok) throw new Error(`فشل جلب أسعار الصرف: ${response.statusText}`);
        const data = await response.json();
        if (data.result === 'success' && data.rates) {
          const rates: ExchangeRates = { USD: 1 };
          for (const currencyCode of Object.keys(CURRENCIES)) {
              if (currencyCode !== 'USD' && data.rates[currencyCode]) {
                  rates[currencyCode as Currency] = data.rates[currencyCode];
              }
          }
          setExchangeRates(rates);
        } else {
          throw new Error('تنسيق بيانات سعر الصرف غير صالح.');
        }
      } catch (error: any) {
        setRateError(error.message || 'حدث خطأ غير متوقع أثناء جلب أسعار الصرف.');
        setExchangeRates(null);
      } finally {
        setRateLoading(false);
      }
    };
    fetchRates();
  }, []);

  const loadDataFromLocalStorage = <T extends { creationDate?: Date | string, expenseDate?: Date | string }>(key: string, schema: z.ZodType<T>, dateFields: (keyof T)[] = []): T[] => {
    if (typeof window === 'undefined') return [];
    const storedData = localStorage.getItem(key);
    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData).map((item: any) => {
                const newItem = { ...item };
                dateFields.forEach(dateField => {
                    if (newItem[dateField] && typeof newItem[dateField] === 'string') {
                        const parsedDate = new Date(newItem[dateField]);
                        newItem[dateField] = isNaN(parsedDate.getTime()) ? (dateField === 'paidDate' || dateField === 'dueDate' || dateField === 'paymentDate' || dateField === 'expenseDate' ? new Date() : undefined) : parsedDate;
                    } else if (newItem[dateField] && !(newItem[dateField] instanceof Date)) {
                         newItem[dateField] = (dateField === 'paidDate' || dateField === 'dueDate' || dateField === 'paymentDate' || dateField === 'expenseDate' ? new Date() : undefined);
                    }
                });
                if (!newItem.creationDate) {
                    newItem.creationDate = new Date();
                } else if (typeof newItem.creationDate === 'string') {
                    const parsedCreationDate = new Date(newItem.creationDate);
                    newItem.creationDate = isNaN(parsedCreationDate.getTime()) ? new Date() : parsedCreationDate;
                }
                 if (key === EXPENSE_STORAGE_KEY && !newItem.expenseDate) { // Ensure expenseDate defaults correctly
                    newItem.expenseDate = new Date();
                }
                return newItem;
            });
            return parsedData.filter((item: any) => {
                try {
                    schema.parse(item);
                    return true;
                } catch (e) {
                    console.warn(`Invalid data for key ${key} in localStorage:`, item, e);
                    return false;
                }
            });
        } catch (error) {
            console.error(`Failed to parse data for ${key} from localStorage:`, error);
        }
    }
    return [];
  };

  useEffect(() => {
    setIsMounted(true);
    setClients(loadDataFromLocalStorage(CLIENT_STORAGE_KEY, clientSchema, ['creationDate']));
    setPayments(loadDataFromLocalStorage(PAYMENT_STORAGE_KEY, paymentSchema, ['paymentDate']));
    setDebts(loadDataFromLocalStorage(DEBT_STORAGE_KEY, debtSchema, ['dueDate', 'paidDate', 'creationDate']));
    setAppointments(loadDataFromLocalStorage(APPOINTMENT_STORAGE_KEY, appointmentSchema, ['date', 'creationDate']));
    setTasks(loadDataFromLocalStorage(TASK_STORAGE_KEY, taskSchema, ['dueDate', 'creationDate']));
    setExpenses(loadDataFromLocalStorage(EXPENSE_STORAGE_KEY, expenseSchema, ['expenseDate', 'creationDate']));

    const storedDate = localStorage.getItem(SELECTED_DATE_STORAGE_KEY);
    if (storedDate) {
        const parsedDate = new Date(storedDate);
        if (!isNaN(parsedDate.getTime())) {
            setSelectedDate(parsedDate);
        }
    }
  }, []);

  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients)); }, [clients, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payments)); }, [payments, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts)); }, [debts, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(appointments)); }, [appointments, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks)); }, [tasks, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses)); }, [expenses, isMounted]);
  useEffect(() => { if (isMounted && typeof window !== 'undefined') localStorage.setItem(SELECTED_DATE_STORAGE_KEY, selectedDate.toISOString());}, [selectedDate, isMounted]);


  const clientForm = useForm<Client>({ resolver: zodResolver(clientSchema), defaultValues: { name: '', project: '', totalProjectCost: 0, currency: 'EGP' }});
  const paymentForm = useForm<PaymentFormData>({ resolver: zodResolver(paymentFormSchema), defaultValues: { paymentAmount: 0, paymentDate: new Date() }});
  const debtForm = useForm<Debt>({ resolver: zodResolver(debtSchema), defaultValues: { description: '', debtorName: '', creditorName: '', amount: 0, currency: 'EGP', dueDate: new Date(), status: 'outstanding', amountRepaid: 0, notes: '' }});
  const repaymentForm = useForm<RepaymentFormData>({ resolver: zodResolver(repaymentFormSchema) });
  const emailReportForm = useForm<EmailReportFormData>({ resolver: zodResolver(emailReportFormSchema), defaultValues: { recipientEmail: 'husseinghazala39@gmail.com' }});
  const appointmentForm = useForm<Appointment>({ resolver: zodResolver(appointmentSchema), defaultValues: { title: '', date: new Date(), time: '09:00', status: 'scheduled' } });
  const taskForm = useForm<Task>({ resolver: zodResolver(taskSchema), defaultValues: { description: '', priority: 'medium', status: 'todo' } });
  const expenseForm = useForm<Expense>({ resolver: zodResolver(expenseSchema), defaultValues: { description: '', amount: 0, currency: 'EGP', category: 'other', expenseDate: selectedDate }});


  const debtStatus = debtForm.watch('status');
  const debtAmount = debtForm.watch('amount');
  const debtAmountRepaid = debtForm.watch('amountRepaid');
  const debtSelectedCurrency = debtForm.watch('currency');

  useEffect(() => {
      if (debtStatus === 'outstanding') {
          debtForm.setValue('amountRepaid', 0);
          debtForm.setValue('paidDate', undefined);
          debtForm.clearErrors(['amountRepaid', 'paidDate']);
      } else if (debtStatus === 'paid') {
          const totalAmount = debtForm.getValues('amount');
          if (totalAmount > 0) debtForm.setValue('amountRepaid', totalAmount);
          if (!debtForm.getValues('paidDate')) debtForm.setValue('paidDate', new Date());
      } else if (debtStatus === 'partially_paid') {
          if (!debtForm.getValues('paidDate') && (debtForm.getValues('amountRepaid') ?? 0) > 0) {
              debtForm.setValue('paidDate', new Date());
          }
      }
  }, [debtStatus, debtForm]);

  useEffect(() => {
    expenseForm.setValue('expenseDate', selectedDate);
  }, [selectedDate, expenseForm]);

  const onClientSubmit = useCallback((values: Client) => {
      const newClient = { ...values, id: crypto.randomUUID(), creationDate: selectedDate };
      setClients((prev) => [...prev, newClient]);
      showToast({ title: 'تمت إضافة العميل', description: `${values.name} تمت إضافته بنجاح.` });
      clientForm.reset();
  }, [showToast, clientForm, selectedDate]);

  const onPaymentSubmit = useCallback((clientId: string, clientCurrency: Currency) => (values: PaymentFormData) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        const totalPaid = calculateTotalPaid(clientId, payments, selectedDate);
        const remaining = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);
        if (values.paymentAmount > remaining && client.totalProjectCost - totalPaid > 0) {
             paymentForm.setError('paymentAmount', { type: 'manual', message: `مبلغ الدفعة يتجاوز المبلغ المتبقي (${formatCurrency(remaining, clientCurrency)}).` });
             return;
        }
        const newPayment: Payment = { id: crypto.randomUUID(), clientId, amount: values.paymentAmount, paymentDate: values.paymentDate, currency: clientCurrency };
        setPayments((prev) => [...prev, newPayment]);
        showToast({ title: 'تمت إضافة دفعة', description: `تم تسجيل دفعة لـ ${client.name}.` });
        paymentForm.reset();
        setAddingPaymentForClientId(null);
    }, [clients, payments, showToast, paymentForm, selectedDate]);

  const onDebtSubmit = useCallback((values: Debt) => {
       let finalValues = { ...values, creationDate: selectedDate };
        if (finalValues.status === 'outstanding') {
            finalValues.amountRepaid = 0;
            finalValues.paidDate = undefined;
        } else if (finalValues.status === 'paid') {
            finalValues.amountRepaid = finalValues.amount;
            if (!finalValues.paidDate) finalValues.paidDate = new Date();
        } else {
            finalValues.amountRepaid = finalValues.amountRepaid ?? 0;
            if (finalValues.amountRepaid > 0 && !finalValues.paidDate) finalValues.paidDate = new Date();
            if (finalValues.amountRepaid <= 0) finalValues.paidDate = undefined;
        }
       const newDebt = { ...finalValues, id: crypto.randomUUID() };
       setDebts((prev) => [...prev, newDebt]);
       showToast({ title: 'تمت إضافة الدين', description: `تمت إضافة الدين على ${values.debtorName}.` });
       debtForm.reset({ description: '', debtorName: '', creditorName: '', amount: 0, currency: 'EGP', dueDate: new Date(), status: 'outstanding', amountRepaid: 0, notes: '' });
   }, [showToast, debtForm, selectedDate]);

  const onRepaymentSubmit = useCallback((debtId: string) => (values: RepaymentFormData) => {
        const debtIndex = debts.findIndex(d => d.id === debtId);
        if (debtIndex === -1) return;
        const originalDebt = debts[debtIndex];
        if (values.amountRepaid > originalDebt.amount) {
            repaymentForm.setError('amountRepaid', { type: 'manual', message: `المبلغ المسدد يتجاوز الإجمالي.` });
            return;
        }
         let newStatus: DebtStatus = 'partially_paid';
         if (values.amountRepaid <= 0) {
             newStatus = 'outstanding'; values.amountRepaid = 0; values.paidDate = undefined;
         } else if (values.amountRepaid >= originalDebt.amount) {
             newStatus = 'paid'; values.amountRepaid = originalDebt.amount;
         }
        const updatedDebt: Debt = { ...originalDebt, amountRepaid: values.amountRepaid, paidDate: values.paidDate, status: newStatus };
        const validationResult = debtSchema.safeParse(updatedDebt);
         if (!validationResult.success) {
             showToast({ title: 'خطأ في تحديث السداد', description: `فشل التحديث. ${validationResult.error.errors?.[0]?.message}`, variant: 'destructive' });
             validationResult.error.errors.forEach(err => {
                 if (err.path[0] === 'amountRepaid' || err.path[0] === 'paidDate') {
                    repaymentForm.setError(err.path[0] as keyof RepaymentFormData, { type: 'manual', message: err.message });
                 }
             });
             return;
        }
        setDebts(prev => { const newDebts = [...prev]; newDebts[debtIndex] = validationResult.data; return newDebts; });
         showToast({ title: 'تم تحديث السداد', description: `تم تحديث دين ${originalDebt.debtorName}.` });
        repaymentForm.reset();
        setEditingRepaymentForDebtId(null);
    }, [debts, showToast, repaymentForm]);

  const onAppointmentSubmit = useCallback((values: Appointment) => {
      const newAppointment = { ...values, id: crypto.randomUUID(), creationDate: selectedDate };
      setAppointments(prev => [...prev, newAppointment]);
      showToast({ title: "تمت إضافة الموعد", description: `تمت إضافة "${values.title}" بنجاح.` });
      appointmentForm.reset({ title: '', date: new Date(), time: '09:00', status: 'scheduled' });
  }, [showToast, appointmentForm, selectedDate]);

  const onTaskSubmit = useCallback((values: Task) => {
      const newTask = { ...values, id: crypto.randomUUID(), creationDate: selectedDate };
      setTasks(prev => [...prev, newTask]);
      showToast({ title: "تمت إضافة المهمة", description: `تمت إضافة "${values.description}" بنجاح.` });
      taskForm.reset({ description: '', priority: 'medium', status: 'todo' });
  }, [showToast, taskForm, selectedDate]);

  const onExpenseSubmit = useCallback((values: Expense) => {
      const newExpense = { ...values, id: crypto.randomUUID(), creationDate: selectedDate, expenseDate: values.expenseDate || selectedDate };
      setExpenses((prev) => [...prev, newExpense]);
      showToast({ title: 'تمت إضافة المصروف', description: `تمت إضافة مصروف "${values.description}" بنجاح.` });
      expenseForm.reset({ description: '', amount: 0, currency: 'EGP', category: 'other', expenseDate: selectedDate });
  }, [showToast, expenseForm, selectedDate]);


  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    setPayments(prev => prev.filter(p => p.clientId !== id));
    showToast({ title: 'تم حذف العميل', variant: 'destructive' });
    if (addingPaymentForClientId === id) setAddingPaymentForClientId(null);
  }, [showToast, addingPaymentForClientId]);

  const deletePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    showToast({ title: 'تم حذف الدفعة', variant: 'destructive' });
  }, [showToast]);

  const deleteDebt = useCallback((id: string) => {
    setDebts(prev => prev.filter(d => d.id !== id));
    showToast({ title: 'تم حذف الدين', variant: 'destructive' });
    if (editingRepaymentForDebtId === id) setEditingRepaymentForDebtId(null);
  }, [showToast, editingRepaymentForDebtId]);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    showToast({ title: "تم حذف الموعد", variant: "destructive" });
  }, [showToast]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast({ title: "تم حذف المهمة", variant: "destructive" });
  }, [showToast]);

  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast({ title: 'تم حذف المصروف', variant: 'destructive' });
  }, [showToast]);


  const handleClientStatusChange = useCallback((clientId: string, newStatusTarget: PaymentStatus) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        const totalPaid = calculateTotalPaid(clientId, payments, selectedDate);
        const currentStatus = determinePaymentStatus(totalPaid, client.totalProjectCost);
        let openPaymentForm = false;
        let toastTitle = '';
        let toastDescription = '';
        let toastVariant: 'default' | 'destructive' | 'warning' = 'default';

        if (newStatusTarget === currentStatus) {
             if ((newStatusTarget === 'partially_paid' || newStatusTarget === 'not_paid') && addingPaymentForClientId !== clientId) {
                setAddingPaymentForClientId(clientId);
                paymentForm.reset({ paymentAmount: 0, paymentDate: new Date() });
             }
            return;
        }

        if (newStatusTarget === 'paid') {
            if (totalPaid < client.totalProjectCost) {
                toastTitle = 'لا يمكن التحديث إلى "تم الدفع"';
                toastDescription = `العميل ${client.name} لم يسدد التكلفة الإجمالية بعد. المبلغ المتبقي ${formatCurrency(client.totalProjectCost - totalPaid, client.currency)}. قم بإضافة دفعة لتغطية المبلغ المتبقي.`;
                toastVariant = 'destructive';
                 openPaymentForm = true;
            } else {
                 toastTitle = 'تم التأكيد';
                 toastDescription = `حالة ${client.name} هي بالفعل "تم الدفع".`;
                 if (addingPaymentForClientId === clientId) setAddingPaymentForClientId(null);
            }
        } else if (newStatusTarget === 'partially_paid') {
            openPaymentForm = true;
            if (totalPaid >= client.totalProjectCost) {
                toastTitle = 'تنبيه';
                toastDescription = `العميل ${client.name} قام بالفعل بدفع التكلفة كاملة أو أكثر. يمكنك إضافة دفعة، لكن الحالة ستبقى "تم الدفع".`;
                toastVariant = 'warning';
            } else if (totalPaid <= 0) {
                toastTitle = 'إضافة دفعة أولى';
                toastDescription = `لتغيير حالة ${client.name} إلى "دفع جزئي"، الرجاء إضافة أول دفعة.`;
            } else {
                toastTitle = 'تعديل/إضافة دفعة';
                toastDescription = `حالة ${client.name} هي "دفع جزئي". يمكنك تعديل الدفعات المسجلة أو إضافة دفعة جديدة.`;
            }
        } else if (newStatusTarget === 'not_paid') {
            if (totalPaid > 0) {
                toastTitle = 'لا يمكن التحديث إلى "لم يتم الدفع"';
                toastDescription = `توجد دفعات مسجلة للعميل ${client.name}. لحذف الدفعات، قم بحذف سجلات الدفعات الفردية.`;
                toastVariant = 'destructive';
                openPaymentForm = false;
            } else {
                toastTitle = 'تم التأكيد';
                toastDescription = `حالة ${client.name} هي "لم يتم الدفع".`;
                if (addingPaymentForClientId === clientId) setAddingPaymentForClientId(null);
            }
        }

         showToast({ title: toastTitle, description: toastDescription, variant: toastVariant as 'default' | 'destructive' });
         if (openPaymentForm) {
             setAddingPaymentForClientId(clientId);
             const initialPaymentAmount = (newStatusTarget === 'partially_paid' && totalPaid > 0) ? 0 : 0;
             paymentForm.reset({ paymentAmount: initialPaymentAmount, paymentDate: new Date() });
         }
         setClients(prev => [...prev]);
   }, [clients, payments, showToast, paymentForm, addingPaymentForClientId, selectedDate]);


  const updateDebtStatus = useCallback((debtId: string, newStatus: DebtStatus) => {
      const debtIndex = debts.findIndex(d => d.id === debtId);
      if (debtIndex === -1) return;
      const originalDebt = debts[debtIndex];
      let updatedDebt = { ...originalDebt, status: newStatus };
      let showRepaymentForm = false;
      let toastMessage = '';
      let toastVariant: 'default' | 'destructive' | 'warning' = 'default';


      if (originalDebt.status === newStatus) {
          if ((newStatus === 'partially_paid' || newStatus === 'outstanding') && editingRepaymentForDebtId !== debtId) {
              setEditingRepaymentForDebtId(debtId);
              repaymentForm.reset({ amountRepaid: originalDebt.amountRepaid ?? 0, paidDate: originalDebt.paidDate || new Date() });
          }
          return;
      }

      if (newStatus === 'outstanding') {
          updatedDebt.amountRepaid = 0;
          updatedDebt.paidDate = undefined;
          toastMessage = `تم تحديث حالة الدين إلى "مستحق".`;
          if (editingRepaymentForDebtId === debtId) setEditingRepaymentForDebtId(null);
          showRepaymentForm = true;
          repaymentForm.reset({ amountRepaid: 0, paidDate: new Date() });
      } else if (newStatus === 'paid') {
          updatedDebt.amountRepaid = originalDebt.amount;
          if (!updatedDebt.paidDate || originalDebt.status !== 'paid') updatedDebt.paidDate = new Date();
          toastMessage = `تم تحديث حالة الدين إلى "تم السداد".`;
          if (editingRepaymentForDebtId === debtId) setEditingRepaymentForDebtId(null);
      } else {
            toastMessage = `تم تحديث حالة الدين إلى "سداد جزئي". يرجى تعديل المبلغ المسدد.`;
            showRepaymentForm = true;
            repaymentForm.reset({ amountRepaid: originalDebt.amountRepaid ?? 0, paidDate: originalDebt.paidDate || new Date() });
      }

      const validationResult = debtSchema.safeParse(updatedDebt);
      if (!validationResult.success) {
           showToast({ title: 'خطأ في تحديث الحالة', description: `فشل التحديث. ${validationResult.error.errors?.[0]?.message}`, variant: 'destructive' });
           return;
      }
       setDebts(prev => { const newDebts = [...prev]; newDebts[debtIndex] = validationResult.data; return newDebts; });
        showToast({ title: 'تم تحديث الحالة', description: toastMessage, variant: toastVariant });
        if (showRepaymentForm) setEditingRepaymentForDebtId(debtId);
        else if (editingRepaymentForDebtId === debtId && !showRepaymentForm) {
            setEditingRepaymentForDebtId(null);
        }
  }, [debts, showToast, repaymentForm, editingRepaymentForDebtId]);

  const updateAppointmentStatus = useCallback((id: string, status: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    showToast({ title: "تم تحديث حالة الموعد" });
  }, [showToast]);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : a));
    showToast({ title: "تم تحديث حالة المهمة" });
  }, [showToast]);


   const convertToUSD = useCallback((amount: number, fromCurrency: Currency): number | null => {
       if (rateLoading || !exchangeRates) return null;
       const rateToUSD = exchangeRates[fromCurrency];
       if (!rateToUSD) return null;
       if (fromCurrency === 'USD') return amount;
       return amount / rateToUSD;
   }, [exchangeRates, rateLoading]);

  const requestSort = (
    key: any,
    config: any,
    setConfig: React.Dispatch<React.SetStateAction<any>>
  ) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (config.key === key && config.direction === 'ascending') {
      direction = 'descending';
    }
    setConfig({ key, direction });
  };

  const requestClientSort = (key: keyof Client | 'derivedStatus' | 'derivedAmountPaid' | 'derivedRemainingAmount' | 'derivedPaymentDate') => requestSort(key, clientSortConfig, setClientSortConfig);
  const requestDebtSort = (key: keyof Debt | 'remainingDebt') => requestSort(key, debtSortConfig, setDebtSortConfig);
  const requestAppointmentSort = (key: keyof Appointment) => requestSort(key, appointmentSortConfig, setAppointmentSortConfig);
  const requestTaskSort = (key: keyof Task) => requestSort(key, taskSortConfig, setTaskSortConfig);
  const requestExpenseSort = (key: keyof Expense) => requestSort(key, expenseSortConfig, setExpenseSortConfig);


  const handleResetClientTable = useCallback(() => {
    setClientSortConfig({ key: null, direction: 'ascending' });
    showToast({ title: 'تم إعادة تعيين جدول العملاء', description: 'تمت إزالة الفرز والتصفية.' });
  }, [showToast]);


  const filteredClients = useMemo(() => {
    if (!isMounted) return [];
    return clients.filter(client => {
        const clientCreationDate = client.creationDate ? new Date(client.creationDate) : new Date(0);
        return clientCreationDate.getFullYear() === selectedDate.getFullYear() &&
               clientCreationDate.getMonth() === selectedDate.getMonth();
    });
  }, [clients, selectedDate, isMounted]);

  const sortedClients = useMemo(() => {
    if (!isMounted) return [];
    const clientsWithDerivedData = filteredClients.map(client => {
        const totalPaid = calculateTotalPaid(client.id!, payments, selectedDate);
        const status = determinePaymentStatus(totalPaid, client.totalProjectCost);
        const remainingAmount = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);
        const latestPaymentDate = getLatestPaymentDate(client.id!, payments);
        return { ...client, derivedStatus: status, derivedAmountPaid: totalPaid, derivedRemainingAmount: remainingAmount, derivedPaymentDate: latestPaymentDate };
    });
    return [...clientsWithDerivedData].sort((a, b) => {
        if (!clientSortConfig.key) return 0;
        let aValue, bValue;
        if (clientSortConfig.key === 'derivedStatus') { aValue = PAYMENT_STATUSES[a.derivedStatus]; bValue = PAYMENT_STATUSES[b.derivedStatus]; }
        else if (clientSortConfig.key === 'derivedAmountPaid') { aValue = a.derivedAmountPaid; bValue = b.derivedAmountPaid; }
        else if (clientSortConfig.key === 'derivedRemainingAmount') { aValue = a.derivedRemainingAmount; bValue = b.derivedRemainingAmount; }
        else if (clientSortConfig.key === 'derivedPaymentDate') { aValue = a.derivedPaymentDate; bValue = b.derivedPaymentDate; }
        else { aValue = a[clientSortConfig.key as keyof Client]; bValue = b[clientSortConfig.key as keyof Client]; }

        const aHasValue = aValue !== undefined && aValue !== null;
        const bHasValue = bValue !== undefined && bValue !== null;
        if (!aHasValue && !bHasValue) return 0;
        if (!aHasValue) return clientSortConfig.direction === 'ascending' ? 1 : -1;
        if (!bHasValue) return clientSortConfig.direction === 'ascending' ? -1 : 1;

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
        else if (aValue instanceof Date && bValue instanceof Date) comparison = aValue.getTime() - bValue.getTime();
        else comparison = String(aValue).localeCompare(String(bValue), 'en');
        return clientSortConfig.direction === 'ascending' ? comparison : -comparison;
    });
  }, [filteredClients, payments, clientSortConfig, isMounted, selectedDate]);

  const filteredDebts = useMemo(() => {
    if (!isMounted) return [];
    return debts.filter(debt => {
        const debtCreationDate = debt.creationDate ? new Date(debt.creationDate) : new Date(0);
        return debtCreationDate.getFullYear() === selectedDate.getFullYear() &&
               debtCreationDate.getMonth() === selectedDate.getMonth();
    });
  }, [debts, selectedDate, isMounted]);

  const sortedDebts = useMemo(() => {
     if (!isMounted) return [];
     return [...filteredDebts].sort((a, b) => {
         if (!debtSortConfig.key) return 0;
         let aValue, bValue;
         if (debtSortConfig.key === 'remainingDebt') { aValue = calculateDebtRemainingAmount(a); bValue = calculateDebtRemainingAmount(b); }
         else { aValue = a[debtSortConfig.key as keyof Debt]; bValue = b[debtSortConfig.key as keyof Debt]; }
         const aHasValue = aValue !== undefined && aValue !== null;
         const bHasValue = bValue !== undefined && bValue !== null;
         if (!aHasValue && !bHasValue) return 0;
         if (!aHasValue) return debtSortConfig.direction === 'ascending' ? 1 : -1;
         if (!bHasValue) return debtSortConfig.direction === 'ascending' ? -1 : 1;
         let comparison = 0;
         if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
         else if (aValue instanceof Date && bValue instanceof Date) comparison = aValue.getTime() - bValue.getTime();
         else comparison = String(aValue).localeCompare(String(bValue), 'en');
         return debtSortConfig.direction === 'ascending' ? comparison : -comparison;
     });
  }, [filteredDebts, debtSortConfig, isMounted]);


  const filteredAppointments = useMemo(() => {
    if (!isMounted) return [];
    return appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        return appointmentDate.getFullYear() === selectedDate.getFullYear() &&
               appointmentDate.getMonth() === selectedDate.getMonth();
    });
  }, [appointments, selectedDate, isMounted]);

  const sortedAppointments = useMemo(() => {
      if(!isMounted) return [];
      return [...filteredAppointments].sort((a, b) => {
          if (!appointmentSortConfig.key) return 0;
          const aValue = a[appointmentSortConfig.key];
          const bValue = b[appointmentSortConfig.key];
          const aHasValue = aValue !== undefined && aValue !== null;
          const bHasValue = bValue !== undefined && bValue !== null;
          if (!aHasValue) return appointmentSortConfig.direction === 'ascending' ? 1 : -1;
          if (!bHasValue) return appointmentSortConfig.direction === 'ascending' ? -1 : 1;
          let comparison = 0;
          if (aValue instanceof Date && bValue instanceof Date) comparison = aValue.getTime() - bValue.getTime();
          else if (typeof aValue === 'string' && typeof bValue === 'string' && appointmentSortConfig.key === 'time') {
            comparison = aValue.localeCompare(bValue, 'en');
          }
          else comparison = String(aValue).localeCompare(String(bValue), 'en');
          return appointmentSortConfig.direction === 'ascending' ? comparison : -comparison;
      });
  }, [filteredAppointments, appointmentSortConfig, isMounted]);

  const filteredTasks = useMemo(() => {
    if (!isMounted) return [];
    return tasks.filter(task => {
        const taskCreationOrDueDate = task.dueDate ? new Date(task.dueDate) : (task.creationDate ? new Date(task.creationDate) : new Date(0));
        return taskCreationOrDueDate.getFullYear() === selectedDate.getFullYear() &&
               taskCreationOrDueDate.getMonth() === selectedDate.getMonth();
    });
  }, [tasks, selectedDate, isMounted]);

  const sortedTasks = useMemo(() => {
      if (!isMounted) return [];
      return [...filteredTasks].sort((a, b) => {
          if (!taskSortConfig.key) return 0;
          let aValue = a[taskSortConfig.key as keyof Task];
          let bValue = b[taskSortConfig.key as keyof Task];
            const aHasValue = aValue !== undefined && aValue !== null;
            const bHasValue = bValue !== undefined && bValue !== null;
            if (!aHasValue) return taskSortConfig.direction === 'ascending' ? 1 : -1;
            if (!bHasValue) return taskSortConfig.direction === 'ascending' ? -1 : 1;
            let comparison = 0;
            if (aValue instanceof Date && bValue instanceof Date) comparison = aValue.getTime() - bValue.getTime();
            else comparison = String(aValue).localeCompare(String(bValue), 'en');
            return taskSortConfig.direction === 'ascending' ? comparison : -comparison;
      });
  }, [filteredTasks, taskSortConfig, isMounted]);

  const filteredExpenses = useMemo(() => {
    if (!isMounted) return [];
    return expenses.filter(expense => {
        const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : new Date(0);
        return expenseDate.getFullYear() === selectedDate.getFullYear() &&
               expenseDate.getMonth() === selectedDate.getMonth();
    });
  }, [expenses, selectedDate, isMounted]);

  const sortedExpenses = useMemo(() => {
    if (!isMounted) return [];
    return [...filteredExpenses].sort((a, b) => {
        if (!expenseSortConfig.key) return 0;
        const aValue = a[expenseSortConfig.key as keyof Expense];
        const bValue = b[expenseSortConfig.key as keyof Expense];
        const aHasValue = aValue !== undefined && aValue !== null;
        const bHasValue = bValue !== undefined && bValue !== null;
        if (!aHasValue) return expenseSortConfig.direction === 'ascending' ? 1 : -1;
        if (!bHasValue) return expenseSortConfig.direction === 'ascending' ? -1 : 1;
        let comparison = 0;
        if (aValue instanceof Date && bValue instanceof Date) comparison = aValue.getTime() - bValue.getTime();
        else if (typeof aValue === 'number' && typeof bValue === 'number') comparison = aValue - bValue;
        else comparison = String(aValue).localeCompare(String(bValue), 'ar'); // Use 'ar' for Arabic string comparison
        return expenseSortConfig.direction === 'ascending' ? comparison : -comparison;
    });
  }, [filteredExpenses, expenseSortConfig, isMounted]);


  const SortableHeader = ({ columnKey, title, config, requestSortFn }: { columnKey: any, title: string, config: any, requestSortFn: (key: any) => void }) => (
    <TableHead onClick={() => requestSortFn(columnKey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {title}
        {config.key === columnKey && <ArrowUpDown className={`h-4 w-4 text-foreground transform ${config.direction === 'descending' ? 'rotate-180' : ''}`} />}
        {config.key !== columnKey && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
      </div>
    </TableHead>
  );

  const totalPaidUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      const paymentsForMonth = payments.filter(p => {
          const paymentDate = p.paymentDate;
          return paymentDate.getFullYear() === selectedDate.getFullYear() && paymentDate.getMonth() === selectedDate.getMonth();
      });
      return paymentsForMonth.reduce((sum, payment) => {
          const amountInUSD = convertToUSD(payment.amount, payment.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
  }, [payments, isMounted, exchangeRates, rateLoading, convertToUSD, selectedDate]);

    const totalRemainingUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return filteredClients.reduce((sum, client) => {
          const totalPaid = calculateTotalPaid(client.id!, payments, selectedDate);
          const remainingAmount = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);
          const amountInUSD = convertToUSD(remainingAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
    }, [filteredClients, payments, isMounted, exchangeRates, rateLoading, convertToUSD, selectedDate]);

    const totalOutstandingDebtUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return filteredDebts.reduce((sum, debt) => {
        if (debt.status === 'paid') return sum;
        const remainingDebt = calculateDebtRemainingAmount(debt);
        const amountInUSD = convertToUSD(remainingDebt, debt.currency);
        return sum + (amountInUSD ?? 0);
      }, 0);
    }, [filteredDebts, isMounted, exchangeRates, rateLoading, convertToUSD]);

    const totalExpensesUSD = useMemo(() => {
        if (!isMounted || rateLoading || !exchangeRates) return null;
        return filteredExpenses.reduce((sum, expense) => {
            const amountInUSD = convertToUSD(expense.amount, expense.currency);
            return sum + (amountInUSD ?? 0);
        }, 0);
    }, [filteredExpenses, isMounted, exchangeRates, rateLoading, convertToUSD]);


    const netWealthForZakatUSD = useMemo(() => {
        if (totalPaidUSD === null || totalOutstandingDebtUSD === null || totalExpensesUSD === null) return null;
        return totalPaidUSD - totalOutstandingDebtUSD - totalExpensesUSD;
    }, [totalPaidUSD, totalOutstandingDebtUSD, totalExpensesUSD]);

    const zakatAmountEGP = useMemo(() => {
        if (netWealthForZakatUSD === null || netWealthForZakatUSD <= 0 || !exchangeRates || !exchangeRates.EGP) return null;
        const netWealthEGP = netWealthForZakatUSD * exchangeRates.EGP;
        return netWealthEGP * ZAKAT_RATE;
    }, [netWealthForZakatUSD, exchangeRates]);


 const cumulativeChartData: CumulativeChartData[] | null = useMemo(() => {
   if (!isMounted || rateLoading || !exchangeRates) return null;

   const startOfMonthDate = dateFnsStartOfMonth(selectedDate);
   const endOfMonthDate = dateFnsEndOfMonth(selectedDate);

   const paymentsInMonthUSD = payments
     .filter(payment => {
         const paymentDate = new Date(payment.paymentDate);
         return !isNaN(paymentDate.getTime()) &&
                paymentDate >= startOfMonthDate &&
                paymentDate <= endOfMonthDate;
      })
     .map(payment => ({
       date: new Date(payment.paymentDate!),
       amountUSD: convertToUSD(payment.amount, payment.currency) ?? 0,
       clientName: clients.find(c => c.id === payment.clientId)?.name || 'عميل غير معروف',
       originalAmount: payment.amount,
       originalCurrency: payment.currency,
     }))
     .filter(p => p.amountUSD > 0)
     .sort((a, b) => a.date.getTime() - b.date.getTime());

   let cumulativeAmount = 0;
   const cumulativeDataPoints = paymentsInMonthUSD.map(payment => {
       cumulativeAmount += payment.amountUSD;
       return {
           date: payment.date,
           dateFormatted: format(payment.date, 'd MMM', { locale: arSA }),
           cumulativeAmountUSD: cumulativeAmount,
           paymentAmountUSD: payment.amountUSD,
           clientName: payment.clientName,
           originalAmount: payment.originalAmount,
           originalCurrency: payment.originalCurrency,
       };
   });

    const startPoint: CumulativeChartData = { date: startOfMonthDate, dateFormatted: format(startOfMonthDate, 'd MMM', { locale: arSA }), cumulativeAmountUSD: 0, paymentAmountUSD: 0, clientName: '', originalAmount: 0, originalCurrency: 'USD' };
    let finalChartData = [startPoint, ...cumulativeDataPoints];

   if (cumulativeDataPoints.length > 0) {
       const lastDataPoint = cumulativeDataPoints[cumulativeDataPoints.length - 1];
       if (lastDataPoint.date.getTime() < endOfMonthDate.getTime() && !finalChartData.find(dp => dp.date.getTime() === endOfMonthDate.getTime())) {
           finalChartData.push({ ...lastDataPoint, date: endOfMonthDate, dateFormatted: format(endOfMonthDate, 'd MMM', { locale: arSA }), paymentAmountUSD: 0, clientName: '' });
       }
   } else if (finalChartData.length === 1 && startOfMonthDate.getTime() !== endOfMonthDate.getTime()) {
        finalChartData.push({ ...startPoint, date: endOfMonthDate, dateFormatted: format(endOfMonthDate, 'd MMM', { locale: arSA }) });
   }
   return finalChartData;
 }, [payments, clients, isMounted, exchangeRates, rateLoading, convertToUSD, selectedDate]);


  const handleSendReportManually = useCallback(async (data: EmailReportFormData) => {
      setIsSendingReport(true);
      showToast({ title: 'جاري إرسال التقرير...', description: `لحظات قليلة ويتم محاولة إرسال التقرير إلى ${data.recipientEmail}.` });

      const today = new Date();
      const endOfYearDate = endOfYear(today);
      const daysRemainingInYear = differenceInDays(endOfYearDate, today);

      const currentMonthStart = dateFnsStartOfMonth(today);
      const currentMonthEnd = dateFnsEndOfMonth(today);

      const clientsForReport = clients.filter(c => {
          const ccDate = c.creationDate ? new Date(c.creationDate) : new Date(0);
          return ccDate <= currentMonthEnd;
      }).map(c => ({
          ...c,
          payments: payments.filter(p => p.clientId === c.id && new Date(p.paymentDate) >= currentMonthStart && new Date(p.paymentDate) <= currentMonthEnd)
      }));

      const debtsForReport = debts.filter(d => {
          const dcDate = d.creationDate ? new Date(d.creationDate) : new Date(0);
          return dcDate <= currentMonthEnd;
      });
      const appointmentsForReport = appointments.filter(a => {
        const appointmentDate = new Date(a.date);
        return appointmentDate >= currentMonthStart && appointmentDate <= currentMonthEnd;
      });
      const tasksForReport = tasks.filter(t => {
        const taskDueDate = t.dueDate ? new Date(t.dueDate) : null;
        const taskCreationDate = t.creationDate ? new Date(t.creationDate) : new Date(0);
        return (taskDueDate && taskDueDate >= currentMonthStart && taskDueDate <= currentMonthEnd) ||
               (!taskDueDate && taskCreationDate >= currentMonthStart && taskCreationDate <= currentMonthEnd);
      });
      const expensesForReport = expenses.filter(e => {
        const expenseDate = e.expenseDate ? new Date(e.expenseDate) : new Date(0);
        return expenseDate >= currentMonthStart && expenseDate <= currentMonthEnd;
      });


      const htmlChart = cumulativeChartData && cumulativeChartData.length > 1 ?
          `<p style="text-align:center; margin-top:20px;">لعرض الرسم البياني، يرجى فتح الملف المرفق Excel أو مراجعة لوحة التحكم.</p>` :
          '<p style="text-align:center; margin-top:20px;">لا توجد بيانات كافية لعرض الرسم البياني للدخل الشهري.</p>';

      try {
          const reportInputData: DailyReportInput = {
               clients: clientsForReport.map(c => ({...c, creationDate: c.creationDate?.toISOString()})),
               debts: debtsForReport.map(d => ({ ...d, creationDate: d.creationDate?.toISOString(), dueDate: d.dueDate.toISOString(), paidDate: d.paidDate?.toISOString() })),
               appointments: appointmentsForReport.map(a => ({ ...a, creationDate: a.creationDate?.toISOString(), date: a.date.toISOString()})),
               tasks: tasksForReport.map(t => ({ ...t, creationDate: t.creationDate?.toISOString(), dueDate: t.dueDate?.toISOString()})),
               expenses: expensesForReport.map(e => ({ ...e, creationDate: e.creationDate?.toISOString(), expenseDate: e.expenseDate.toISOString()})),
               summary: {
                   totalPaidUSD: totalPaidUSD,
                   totalRemainingUSD: totalRemainingUSD,
                   totalOutstandingDebtUSD: totalOutstandingDebtUSD,
                   totalExpensesUSD: totalExpensesUSD,
                   zakatAmountEGP: zakatAmountEGP,
               },
               reportDate: today.toISOString(),
               recipientEmail: data.recipientEmail,
               daysRemainingInYear,
               htmlChart,
          };

          const result = await sendDailyReport(reportInputData);
          if (result.success) showToast({ title: 'تم إرسال التقرير', description: `تم إرسال التقرير بنجاح إلى ${data.recipientEmail}. ${result.message}` });
          else throw new Error(result.message);
      } catch (error: any) {
          console.error("Error sending manual report:", error);
          let errorMessage = `حدث خطأ أثناء إرسال التقرير: ${error.message}`;
          if (error.message.includes('Missing credentials') || error.message.includes('Invalid login') || error.message.includes('Email service is not configured')) {
              errorMessage = "فشل إرسال التقرير: بيانات اعتماد البريد الإلكتروني (Gmail) غير صحيحة أو مفقودة. يرجى التحقق من متغيري GMAIL_USER و GMAIL_APP_PASSWORD في ملف .env الخاص بك.";
          }
          showToast({ title: 'فشل إرسال التقرير', description: errorMessage, variant: 'destructive' });
      } finally {
          setIsSendingReport(false);
      }
  }, [clients, debts, appointments, tasks, expenses, totalPaidUSD, totalRemainingUSD, totalOutstandingDebtUSD, totalExpensesUSD, zakatAmountEGP, showToast, cumulativeChartData, payments, selectedDate, convertToUSD, exchangeRates]);

  const handleMonthChange = (newDate: Date) => {
    setSelectedDate(newDate);
    setFinancialAnalysisResult(null);
    setFinancialAnalysisError(null);
    expenseForm.setValue('expenseDate', newDate); // Update default expense date on month change
  };

  const prepareFinancialAnalysisInput = useCallback((): FinancialAnalysisInput | null => {
    if (!isMounted || rateLoading || !exchangeRates || (!clients.length && !payments.length && !expenses.length)) {
        if (isMounted && (!clients.length && !payments.length && !expenses.length)) {
          showToast({ title: "بيانات غير كافية للتحليل", description: "الرجاء إضافة بعض العملاء/الدفعات/المصروفات أولاً.", variant: "destructive" });
        } else if (isMounted && (rateLoading || !exchangeRates)){
          showToast({ title: "جاري تحميل أسعار الصرف", description: "يرجى الانتظار حتى يتم تحميل أسعار الصرف قبل التحليل.", variant: "destructive" });
        }
        return null;
    }

    const monthlyMap: { [key: string]: Partial<MonthlySummary> & { year: number; month: string } } = {};

    const ensurePeriodKey = (year: number, monthStr: string) => {
        const periodKey = `${year}-${monthStr}`;
        if (!monthlyMap[periodKey]) {
            monthlyMap[periodKey] = {
                year,
                month: monthStr,
                totalIncomeUSD: 0,
                totalExpensesUSD: 0, // Initialize expenses
                numberOfClients: 0,
                numberOfProjects: 0,
            };
        }
        return periodKey;
    };

    payments.forEach(payment => {
        const paymentDate = new Date(payment.paymentDate);
        const year = paymentDate.getFullYear();
        const monthStr = String(paymentDate.getMonth() + 1).padStart(2, '0');
        const periodKey = ensurePeriodKey(year, monthStr);
        const incomeUSD = convertToUSD(payment.amount, payment.currency) ?? 0;
        monthlyMap[periodKey].totalIncomeUSD! += incomeUSD;
    });

    expenses.forEach(expense => {
        const expenseDate = new Date(expense.expenseDate);
        const year = expenseDate.getFullYear();
        const monthStr = String(expenseDate.getMonth() + 1).padStart(2, '0');
        const periodKey = ensurePeriodKey(year, monthStr);
        const expenseUSD = convertToUSD(expense.amount, expense.currency) ?? 0;
        monthlyMap[periodKey].totalExpensesUSD! += expenseUSD;
    });


    Object.keys(monthlyMap).forEach(periodKey => {
        const summary = monthlyMap[periodKey];
        const year = summary.year;
        const monthStr = summary.month;
        const clientsInMonth = new Set<string>();
        const projectsInMonth = new Set<string>();

        payments.forEach(p => {
            const pDate = new Date(p.paymentDate);
            if (pDate.getFullYear() === year && String(pDate.getMonth() + 1).padStart(2, '0') === monthStr) {
                clientsInMonth.add(p.clientId);
                const clientDetails = clients.find(c => c.id === p.clientId);
                if (clientDetails) {
                    projectsInMonth.add(clientDetails.project);
                }
            }
        });
        summary.numberOfClients = clientsInMonth.size;
        summary.numberOfProjects = projectsInMonth.size;
    });

    const allMonthlySummaries = Object.values(monthlyMap).map(m => m as MonthlySummary).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month.localeCompare(b.month);
    });

    if (allMonthlySummaries.length === 0) {
         showToast({ title: "لا توجد بيانات دفعات أو مصروفات للتحليل", description: "الرجاء إضافة بعض البيانات أولاً.", variant: "destructive" });
         return null;
    }

    return {
        allMonthlySummaries,
        currentMonthFocus: {
            year: selectedDate.getFullYear(),
            month: String(selectedDate.getMonth() + 1).padStart(2, '0'),
        },
    };
  }, [isMounted, rateLoading, exchangeRates, clients, payments, expenses, convertToUSD, selectedDate, showToast]);

  const handleAnalyzeFinancials = useCallback(async () => {
    const analysisInput = prepareFinancialAnalysisInput();
    if (!analysisInput) return;

    setIsAnalyzingFinancials(true);
    setFinancialAnalysisResult(null);
    setFinancialAnalysisError(null);
    showToast({ title: "جاري تحليل البيانات المالية...", description: "قد يستغرق الأمر بضع لحظات." });

    try {
        const result = await analyzeFinancials(analysisInput);
        setFinancialAnalysisResult(result);
        showToast({ title: "اكتمل التحليل المالي", description: "تم عرض النتائج أدناه." });
    } catch (error: any) {
        console.error("Error analyzing financials:", error);
        setFinancialAnalysisError(`فشل التحليل المالي: ${error.message}`);
        showToast({ title: "خطأ في التحليل المالي", description: error.message, variant: "destructive" });
    } finally {
        setIsAnalyzingFinancials(false);
    }
  }, [prepareFinancialAnalysisInput, showToast]);


  if (!isMounted) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-foreground">جاري تحميل البيانات...</p>
        </div>
    );
  }

  const debtRemainingAmountInForm = calculateDebtRemainingAmount({ amount: debtAmount, amountRepaid: debtAmountRepaid, status: debtStatus });

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">لوحة التحكم المتكاملة</h1>
      <DateTimeDisplay />
      <MonthNavigation selectedDate={selectedDate} onMonthChange={handleMonthChange} />

        {rateLoading && (
            <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300 shadow">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <AlertTitle>جاري جلب أسعار الصرف...</AlertTitle>
            </Alert>
          )}
          {rateError && !rateLoading && (
            <Alert variant="destructive" className="mb-6 shadow">
              <AlertCircle className="h-4 w-4 mr-2"/>
              <AlertTitle>خطأ في سعر الصرف</AlertTitle>
              <AlertDescription>{rateError}</AlertDescription>
            </Alert>
          )}
          {exchangeRates && !rateLoading && <UsdToEgpRateDisplay rates={exchangeRates} />}

        <Card className="mb-8 shadow-sm border border-border rounded-lg overflow-hidden">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-xl text-foreground">إرسال التقرير اليومي</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...emailReportForm}>
              <form onSubmit={emailReportForm.handleSubmit(handleSendReportManually)} className="flex flex-col sm:flex-row items-end gap-4">
                <FormField
                  control={emailReportForm.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-foreground">البريد الإلكتروني للمستلم</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="أدخل البريد الإلكتروني" {...field} className="bg-background"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSendingReport} className="bg-teal-600 hover:bg-teal-700 text-white transition duration-150 ease-in-out sm:self-end">
                    {isSendingReport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> جاري الإرسال...</> : <><Send className="mr-2 h-4 w-4" /> إرسال الآن</>}
                </Button>
              </form>
            </Form>
            <p className="text-xs text-muted-foreground mt-2">
               اضغط لإرسال التقرير المجمع الآن. تأكد من إعداد بيانات اعتماد Gmail.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="clients" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
                <TabsTrigger value="clients">العملاء والمشاريع</TabsTrigger>
                <TabsTrigger value="debts">الديون والمستحقات</TabsTrigger>
                <TabsTrigger value="expenses">المصروفات</TabsTrigger>
                <TabsTrigger value="appointments_tasks">المواعيد والمهام</TabsTrigger>
            </TabsList>

            <TabsContent value="clients">
              <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <CardTitle className="text-xl text-foreground">إضافة عميل جديد</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Form {...clientForm}>
                    <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={clientForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>اسم العميل</FormLabel><FormControl><Input placeholder="اسم العميل" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={clientForm.control} name="project" render={({ field }) => (<FormItem><FormLabel>وصف المشروع</FormLabel><FormControl><Input placeholder="وصف المشروع" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={clientForm.control} name="totalProjectCost" render={({ field }) => (<FormItem><FormLabel>التكلفة الإجمالية</FormLabel><FormControl><Input type="number" placeholder="التكلفة" {...field} step="0.01" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={clientForm.control} name="currency" render={({ field }) => (<FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر العملة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name} ({code})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                      </div>
                      <Button type="submit" className="mt-6 w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">إضافة عميل</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
                 <CardHeader className="bg-muted/50">
                   <CardTitle className="text-xl text-foreground">الدخل الشهري التراكمي (دولار أمريكي)</CardTitle>
                   <CardDescription className="text-muted-foreground mt-2">
                      الرسم البياني يمثل إجمالي الدخل بالدولار الأمريكي المتراكم خلال الشهر المحدد ({format(selectedDate, "MMMM yyyy", { locale: arSA })}).
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="p-4 md:p-6">
                   {cumulativeChartData && cumulativeChartData.length > 1 ? <ClientPaymentChart data={cumulativeChartData} /> : rateLoading ? <div className="flex items-center justify-center h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="ml-2">جاري تحميل الرسم...</p></div> : rateError ? <Alert variant="destructive" className="h-[300px] flex flex-col items-center justify-center"><AlertCircle className="h-6 w-6 mb-2"/><AlertTitle>لا يمكن عرض الرسم</AlertTitle><AlertDescription>خطأ في سعر الصرف.</AlertDescription></Alert> : <Alert className="h-[300px] flex flex-col items-center justify-center"><AlertCircle className="h-6 w-6 mb-2" /><AlertTitle>لا توجد بيانات</AlertTitle><AlertDescription>لا دفعات مسجلة لهذا الشهر.</AlertDescription></Alert>}
                 </CardContent>
               </Card>

               <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
                 <CardHeader className="bg-muted/50 flex flex-row items-center justify-between">
                   <CardTitle className="text-xl text-foreground">سجلات عملاء شهر {format(selectedDate, "MMMM yyyy", { locale: arSA })}</CardTitle>
                    <Button onClick={handleResetClientTable} variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        إعادة تعيين الجدول
                    </Button>
                 </CardHeader>
                 <CardContent className="pt-0">
                   <Table>
                     <TableCaption className="mt-4 mb-2 text-muted-foreground">
                        قائمة بعملائك ومشاريعهم وحالات الدفع للشهر المحدد. اضغط على رؤوس الأعمدة للفرز.
                     </TableCaption>
                     <TableHeader>
                       <TableRow>
                         <SortableHeader columnKey="name" title="اسم العميل" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <SortableHeader columnKey="project" title="المشروع" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <SortableHeader columnKey="totalProjectCost" title="التكلفة الإجمالية" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <TableHead>العملة</TableHead>
                         <SortableHeader columnKey="derivedStatus" title="حالة الدفع" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <SortableHeader columnKey="derivedAmountPaid" title="المدفوع" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <SortableHeader columnKey="derivedRemainingAmount" title="المتبقي" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <TableHead>المتبقي (دولار)</TableHead>
                         <SortableHeader columnKey="derivedPaymentDate" title="تاريخ آخر دفعة" config={clientSortConfig} requestSortFn={requestClientSort} />
                         <TableHead className="text-left">الإجراءات</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {sortedClients.length > 0 ? (
                         sortedClients.map((client) => {
                             const { derivedStatus: paymentStatus, derivedAmountPaid: amountPaid, derivedRemainingAmount: remainingAmount, derivedPaymentDate: latestPaymentDate } = client;
                             const remainingAmountUSD = convertToUSD(remainingAmount, client.currency);
                             const isAddingPayment = addingPaymentForClientId === client.id;

                             return (
                               <React.Fragment key={client.id}>
                                <TableRow className="hover:bg-muted/30 transition-colors duration-150">
                                 <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                                 <TableCell className="text-muted-foreground">{client.project}</TableCell>
                                 <TableCell className="text-foreground">{formatCurrency(client.totalProjectCost, client.currency)}</TableCell>
                                 <TableCell className="text-muted-foreground">{CURRENCIES[client.currency]}</TableCell>
                                 <TableCell>
                                      <Select value={paymentStatus} onValueChange={(newStatus) => client.id && handleClientStatusChange(client.id, newStatus as PaymentStatus)}>
                                         <SelectTrigger className={cn("w-[130px] text-xs", paymentStatus === 'paid' && 'text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/50', paymentStatus === 'partially_paid' && 'text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50', paymentStatus === 'not_paid' && 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/50')}><SelectValue /></SelectTrigger>
                                         <SelectContent>{Object.entries(PAYMENT_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>))}</SelectContent>
                                     </Select>
                                 </TableCell>
                                  <TableCell className="text-green-600 dark:text-green-400">{formatCurrency(amountPaid, client.currency)}</TableCell>
                                  <TableCell className="text-red-600 dark:text-red-400">{formatCurrency(remainingAmount, client.currency)}</TableCell>
                                  <TableCell className="text-blue-600 dark:text-blue-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : remainingAmountUSD !== null ? formatCurrency(remainingAmountUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                                 <TableCell className="text-muted-foreground">{formatDateAr(latestPaymentDate)}</TableCell>
                                 <TableCell className="text-left space-x-1 rtl:space-x-reverse">
                                    {(paymentStatus !== 'paid' || isAddingPayment || paymentStatus === 'partially_paid') && (
                                      <Button variant="outline" size="sm" onClick={() => { const newClientId = client.id === addingPaymentForClientId ? null : client.id; setAddingPaymentForClientId(newClientId); if (newClientId) paymentForm.reset({ paymentAmount: 0, paymentDate: new Date() }); }} className={cn("text-xs", isAddingPayment && "bg-muted")}>
                                        {isAddingPayment ? 'إلغاء' : (amountPaid > 0 ? 'تعديل/إضافة دفعة' : 'إضافة دفعة')}
                                        {!isAddingPayment && <Edit className="h-3 w-3 ml-1 rtl:mr-1 rtl:ml-0" />}
                                      </Button>
                                    )}
                                   <Button variant="ghost" size="icon" onClick={() => client.id && deleteClient(client.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button>
                                 </TableCell>
                               </TableRow>
                                 {isAddingPayment && (
                                     <TableRow className="bg-muted/10 dark:bg-muted/20 border-t border-dashed">
                                         <TableCell colSpan={10} className="p-4">
                                             <Form {...paymentForm}>
                                                 <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit(client.id!, client.currency))} className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                                                     <FormField control={paymentForm.control} name="paymentAmount" render={({ field }) => (<FormItem className="flex-1"><FormLabel>مبلغ الدفعة ({client.currency})</FormLabel><FormControl><Input type="number" placeholder="المبلغ" {...field} step="0.01" max={remainingAmount > 0 || paymentStatus === 'paid' ? remainingAmount : undefined} /></FormControl><FormDescription className="text-xs text-yellow-600 dark:text-yellow-400">المتبقي: {formatCurrency(remainingAmount, client.currency)}</FormDescription><FormMessage /></FormItem>)} />
                                                     <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="mb-1">تاريخ الدفعة</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn('w-[200px] sm:w-[240px] pr-3 text-right font-normal justify-between', !field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر تاريخًا</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50 rtl:mr-auto rtl:ml-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date('1900-01-01')} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                                     <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">تأكيد الدفعة</Button>
                                                 </form>
                                             </Form>
                                              <div className="mt-4 pt-4 border-t"><h4 className="text-sm font-medium mb-2 text-foreground">سجل الدفعات:</h4>
                                                  {payments.filter(p => p.clientId === client.id).length > 0 ? (<ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">{payments.filter(p => p.clientId === client.id).sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()).map(p => (<li key={p.id} className="flex justify-between items-center"><span>{formatCurrency(p.amount, p.currency)} - {formatDateAr(p.paymentDate)}</span><Button variant="ghost" size="icon" onClick={() => deletePayment(p.id)} className="text-destructive h-6 w-6"><Trash2 className="h-3 w-3" /></Button></li>))}</ul>) : (<p className="text-xs text-muted-foreground">لا دفعات مسجلة.</p>)}
                                              </div>
                                         </TableCell>
                                     </TableRow>
                                 )}
                               </React.Fragment>
                             );
                         })
                       ) : (
                         <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لم تتم إضافة عملاء لهذا الشهر.</TableCell></TableRow>
                       )}
                     </TableBody>
                      <TableFooter className="bg-muted/30 dark:bg-muted/20">
                         <TableRow>
                           <TableCell colSpan={7} className="font-semibold text-right text-foreground">الإجمالي المتبقي (دولار)</TableCell>
                           <TableCell className="font-bold text-red-600 dark:text-red-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalRemainingUSD !== null ? formatCurrency(totalRemainingUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                         </TableRow>
                          <TableRow>
                           <TableCell colSpan={7} className="font-semibold text-right text-foreground">إجمالي المدفوع (دولار)</TableCell>
                           <TableCell className="font-bold text-green-600 dark:text-green-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalPaidUSD !== null ? formatCurrency(totalPaidUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                         </TableRow>
                       </TableFooter>
                   </Table>
                 </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="debts">
                <Card className="mb-8 shadow-lg">
                    <CardHeader><CardTitle>إضافة دين جديد</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...debtForm}>
                            <form onSubmit={debtForm.handleSubmit(onDebtSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={debtForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>وصف الدين</FormLabel><FormControl><Input placeholder="الوصف" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="debtorName" render={({ field }) => (<FormItem><FormLabel>المدين</FormLabel><FormControl><Input placeholder="المدين" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="creditorName" render={({ field }) => (<FormItem><FormLabel>الدائن</FormLabel><FormControl><Input placeholder="الدائن" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="المبلغ" {...field} step="0.01" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="currency" render={({ field }) => (<FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="dueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="mb-2">تاريخ الاستحقاق</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn(!field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر</span>}<CalendarIcon className="ml-auto h-4 w-4 rtl:mr-auto rtl:ml-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                    <FormField control={debtForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(DEBT_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                   {(debtStatus === 'paid' || debtStatus === 'partially_paid') && (
                                        <>
                                           <FormField control={debtForm.control} name="amountRepaid" render={({ field }) => (<FormItem><FormLabel>المسدد {debtStatus === 'paid' && <span className='text-xs ml-1 rtl:mr-1 rtl:ml-0'>(يجب أن يساوي الإجمالي)</span>}</FormLabel><FormControl><Input type="number" placeholder="المسدد" {...field} step="0.01" value={field.value ?? ''} onChange={(e) => { const val = e.target.value === '' ? 0 : parseFloat(e.target.value); field.onChange(isNaN(val as number) ? 0 : val); }} disabled={debtStatus === 'paid'} /></FormControl>{debtStatus === 'partially_paid' && debtAmountRepaid !== undefined && debtAmountRepaid !== null && debtAmount > 0 && (<FormDescription className="text-sm text-yellow-600 dark:text-yellow-400">المتبقي: {formatCurrency(debtRemainingAmountInForm, debtSelectedCurrency)}</FormDescription>)}<FormMessage /></FormItem>)} />
                                            <FormField control={debtForm.control} name="paidDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="mb-2">تاريخ السداد</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn(!field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر</span>}<CalendarIcon className="ml-auto h-4 w-4 rtl:mr-auto rtl:ml-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                         </>
                                     )}
                                      <FormField control={debtForm.control} name="notes" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>ملاحظات</FormLabel><FormControl><Textarea placeholder="ملاحظات..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <Button type="submit" className="mt-6">إضافة دين</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                    <CardHeader><CardTitle>سجلات ديون شهر {format(selectedDate, "MMMM yyyy", { locale: arSA })}</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableCaption>قائمة بالديون المستحقة والمدفوعة للشهر المحدد.</TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader columnKey="description" title="الوصف" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="debtorName" title="المدين" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="creditorName" title="الدائن" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="amount" title="المبلغ" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <TableHead>العملة</TableHead>
                                    <SortableHeader columnKey="status" title="الحالة" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="amountRepaid" title="المسدد" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="remainingDebt" title="المتبقي" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <TableHead>المتبقي (دولار)</TableHead>
                                    <SortableHeader columnKey="dueDate" title="الاستحقاق" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <SortableHeader columnKey="paidDate" title="آخر سداد" config={debtSortConfig} requestSortFn={requestDebtSort} />
                                    <TableHead>ملاحظات</TableHead>
                                    <TableHead className="text-left">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDebts.length > 0 ? (
                                    sortedDebts.map((debt) => {
                                        const remainingDebt = calculateDebtRemainingAmount(debt);
                                        const remainingDebtUSD = convertToUSD(remainingDebt, debt.currency);
                                        const amountRepaid = debt.amountRepaid ?? 0;
                                        const isEditingRepayment = editingRepaymentForDebtId === debt.id;
                                        return (
                                           <React.Fragment key={debt.id}>
                                            <TableRow>
                                                <TableCell className="text-foreground">{debt.description}</TableCell>
                                                <TableCell className="text-muted-foreground">{debt.debtorName}</TableCell>
                                                <TableCell className="text-muted-foreground">{debt.creditorName}</TableCell>
                                                <TableCell className="text-foreground">{formatCurrency(debt.amount, debt.currency)}</TableCell>
                                                <TableCell className="text-muted-foreground">{CURRENCIES[debt.currency]}</TableCell>
                                                <TableCell>
                                                    <Select value={debt.status} onValueChange={(newStatus) => debt.id && updateDebtStatus(debt.id, newStatus as DebtStatus)}>
                                                        <SelectTrigger className={cn("w-[130px] text-xs", debt.status === 'paid' && 'text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/50', debt.status === 'partially_paid' && 'text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50', debt.status === 'outstanding' && 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/50')}><SelectValue /></SelectTrigger>
                                                        <SelectContent>{Object.entries(DEBT_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-green-600 dark:text-green-400">{formatCurrency(amountRepaid, debt.currency)}</TableCell>
                                                <TableCell className="text-red-600 dark:text-red-400">{formatCurrency(remainingDebt, debt.currency)}</TableCell>
                                                <TableCell className="text-blue-600 dark:text-blue-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : remainingDebtUSD !== null ? formatCurrency(remainingDebtUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                                                <TableCell className="text-muted-foreground">{formatDateAr(debt.dueDate)}</TableCell>
                                                <TableCell className="text-muted-foreground">{formatDateAr(debt.paidDate)}</TableCell>
                                                <TableCell className="max-w-[150px] truncate text-muted-foreground" title={debt.notes || ''}>{debt.notes || '-'}</TableCell>
                                                <TableCell className="text-left space-x-1 rtl:space-x-reverse">
                                                     {(debt.status !== 'paid' || isEditingRepayment || debt.status === 'partially_paid') && (
                                                      <Button variant="outline" size="sm" onClick={() => { const newDebtId = debt.id === editingRepaymentForDebtId ? null : debt.id; setEditingRepaymentForDebtId(newDebtId); if (newDebtId) repaymentForm.reset({ amountRepaid: debt.amountRepaid ?? 0, paidDate: debt.paidDate || new Date() }); }} className={cn("text-xs", isEditingRepayment && "bg-muted")}>
                                                          {isEditingRepayment ? 'إلغاء' : 'تعديل السداد'} {!isEditingRepayment && <Edit className="h-3 w-3 ml-1 rtl:mr-1 rtl:ml-0" />}
                                                      </Button>
                                                      )}
                                                    <Button variant="ghost" size="icon" onClick={() => debt.id && deleteDebt(debt.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                              {isEditingRepayment && (
                                                  <TableRow className="bg-muted/10 dark:bg-muted/20"><TableCell colSpan={13} className="p-4">
                                                          <Form {...repaymentForm}>
                                                              <form onSubmit={repaymentForm.handleSubmit(onRepaymentSubmit(debt.id!))} className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                                                                  <FormField control={repaymentForm.control} name="amountRepaid" render={({ field }) => (<FormItem className="flex-1"><FormLabel>المبلغ المسدد ({debt.currency})</FormLabel><FormControl><Input type="number" placeholder="المسدد" {...field} step="0.01" max={debt.amount} /></FormControl><FormDescription>الإجمالي: {formatCurrency(debt.amount, debt.currency)}</FormDescription><FormMessage /></FormItem>)} />
                                                                  <FormField control={repaymentForm.control} name="paidDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="mb-1">تاريخ السداد</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn(!field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر</span>}<CalendarIcon className="ml-auto h-4 w-4 rtl:mr-auto rtl:ml-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                                                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">حفظ</Button>
                                                              </form>
                                                          </Form>
                                                  </TableCell></TableRow>
                                              )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">لا توجد ديون مسجلة لهذا الشهر.</TableCell></TableRow>
                                )}
                            </TableBody>
                            <TableFooter className="bg-muted/30 dark:bg-muted/20">
                               <TableRow>
                                 <TableCell colSpan={8} className="font-semibold text-right text-foreground">إجمالي الديون المستحقة (دولار)</TableCell>
                                 <TableCell className="font-bold text-red-600 dark:text-red-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalOutstandingDebtUSD !== null ? formatCurrency(totalOutstandingDebtUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                                  <TableCell colSpan={4}></TableCell>
                               </TableRow>
                             </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="expenses">
                <Card className="mb-8 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground"><ShoppingCart className="h-5 w-5 text-primary"/> إضافة مصروف جديد</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Form {...expenseForm}>
                            <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={expenseForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>وصف المصروف</FormLabel><FormControl><Input placeholder="مثال: فاتورة كهرباء" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={expenseForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="المبلغ" {...field} step="0.01" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={expenseForm.control} name="currency" render={({ field }) => (<FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر العملة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name} ({code})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={expenseForm.control} name="category" render={({ field }) => (<FormItem><FormLabel>الفئة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(EXPENSE_CATEGORIES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={expenseForm.control} name="expenseDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="mb-2">تاريخ المصروف</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر تاريخًا</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50 rtl:mr-auto rtl:ml-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                </div>
                                <Button type="submit" className="mt-6 w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" /> إضافة مصروف</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                    <CardHeader><CardTitle className="text-foreground">سجلات مصروفات شهر {format(selectedDate, "MMMM yyyy", { locale: arSA })}</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableCaption>قائمة بالمصروفات المسجلة للشهر المحدد.</TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader columnKey="description" title="الوصف" config={expenseSortConfig} requestSortFn={requestExpenseSort} />
                                    <SortableHeader columnKey="amount" title="المبلغ" config={expenseSortConfig} requestSortFn={requestExpenseSort} />
                                    <SortableHeader columnKey="currency" title="العملة" config={expenseSortConfig} requestSortFn={requestExpenseSort} />
                                    <SortableHeader columnKey="category" title="الفئة" config={expenseSortConfig} requestSortFn={requestExpenseSort} />
                                    <SortableHeader columnKey="expenseDate" title="التاريخ" config={expenseSortConfig} requestSortFn={requestExpenseSort} />
                                    <TableHead className="text-left">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedExpenses.length > 0 ? (
                                    sortedExpenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="text-foreground">{expense.description}</TableCell>
                                            <TableCell className="text-red-600 dark:text-red-400">{formatCurrency(expense.amount, expense.currency)}</TableCell>
                                            <TableCell className="text-muted-foreground">{CURRENCIES[expense.currency]}</TableCell>
                                            <TableCell className="text-muted-foreground">{EXPENSE_CATEGORIES[expense.category]}</TableCell>
                                            <TableCell className="text-muted-foreground">{formatDateAr(expense.expenseDate)}</TableCell>
                                            <TableCell className="text-left">
                                                <Button variant="ghost" size="icon" onClick={() => expense.id && deleteExpense(expense.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مصروفات مسجلة لهذا الشهر.</TableCell></TableRow>
                                )}
                            </TableBody>
                             <TableFooter className="bg-muted/30 dark:bg-muted/20">
                               <TableRow>
                                 <TableCell colSpan={5} className="font-semibold text-right text-foreground">إجمالي المصروفات (دولار)</TableCell>
                                 <TableCell className="font-bold text-red-600 dark:text-red-400">{rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalExpensesUSD !== null ? formatCurrency(totalExpensesUSD, 'USD') : rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}</TableCell>
                               </TableRow>
                             </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>


            <TabsContent value="appointments_tasks">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground"><CalendarDays className="h-5 w-5 text-primary"/> إضافة موعد جديد</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...appointmentForm}>
                                <form onSubmit={appointmentForm.handleSubmit(onAppointmentSubmit)} className="space-y-4">
                                    <FormField control={appointmentForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>عنوان الموعد</FormLabel><FormControl><Input placeholder="مثال: اجتماع مع العميل X" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={appointmentForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>التاريخ</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? formatDateEn(field.value) : <span>اختر تاريخ</span>}<CalendarIcon className="mr-auto h-4 w-4 opacity-50 rtl:ml-auto rtl:mr-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                        <FormField control={appointmentForm.control} name="time" render={({ field }) => (<FormItem><FormLabel>الوقت</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <FormField control={appointmentForm.control} name="attendees" render={({ field }) => (<FormItem><FormLabel>الحاضرون (اختياري)</FormLabel><FormControl><Input placeholder="أسماء الحضور" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={appointmentForm.control} name="location" render={({ field }) => (<FormItem><FormLabel>المكان/الرابط (اختياري)</FormLabel><FormControl><Input placeholder="مثال: مكتب الشركة أو رابط Zoom" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={appointmentForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الحالة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={appointmentForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>ملاحظات (اختياري)</FormLabel><FormControl><Textarea placeholder="ملاحظات إضافية" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <Button type="submit" className="w-full"><PlusCircle className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" /> إضافة موعد</Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground"><ListFilter className="h-5 w-5 text-primary"/> إضافة مهمة جديدة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...taskForm}>
                                <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                                    <FormField control={taskForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>وصف المهمة</FormLabel><FormControl><Input placeholder="مثال: إعداد عرض تقديمي للمشروع Y" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={taskForm.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>تاريخ الاستحقاق (اختياري)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? formatDateEn(field.value) : <span>اختر تاريخ</span>}<CalendarIcon className="mr-auto h-4 w-4 opacity-50 rtl:ml-auto rtl:mr-0" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={arSA} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                    <FormField control={taskForm.control} name="priority" render={({ field }) => (<FormItem><FormLabel>الأولوية</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الأولوية" /></SelectTrigger></FormControl><SelectContent><SelectItem value="low">منخفضة</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="high">عالية</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={taskForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر الحالة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(TASK_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={taskForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>ملاحظات (اختياري)</FormLabel><FormControl><Textarea placeholder="ملاحظات إضافية" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <Button type="submit" className="w-full"><PlusCircle className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" /> إضافة مهمة</Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <Card className="shadow-lg">
                        <CardHeader><CardTitle className="text-foreground">مواعيد شهر {format(selectedDate, "MMMM yyyy", { locale: arSA })}</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader columnKey="title" title="العنوان" config={appointmentSortConfig} requestSortFn={requestAppointmentSort} />
                                        <SortableHeader columnKey="date" title="التاريخ" config={appointmentSortConfig} requestSortFn={requestAppointmentSort} />
                                        <SortableHeader columnKey="time" title="الوقت" config={appointmentSortConfig} requestSortFn={requestAppointmentSort} />
                                        <SortableHeader columnKey="status" title="الحالة" config={appointmentSortConfig} requestSortFn={requestAppointmentSort} />
                                        <TableHead>الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedAppointments.length > 0 ? sortedAppointments.map(apt => (
                                        <TableRow key={apt.id}>
                                            <TableCell className="text-foreground">{apt.title}</TableCell>
                                            <TableCell className="text-muted-foreground">{formatDateEn(apt.date)}</TableCell>
                                            <TableCell className="text-muted-foreground">{apt.time}</TableCell>
                                            <TableCell>
                                                <Select value={apt.status} onValueChange={(newStatus) => apt.id && updateAppointmentStatus(apt.id, newStatus as AppointmentStatus)}>
                                                    <SelectTrigger className="text-xs w-[120px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>))}</SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => apt.id && deleteAppointment(apt.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد مواعيد لهذا الشهر.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader><CardTitle className="text-foreground">مهام شهر {format(selectedDate, "MMMM yyyy", { locale: arSA })}</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader columnKey="description" title="الوصف" config={taskSortConfig} requestSortFn={requestTaskSort} />
                                        <SortableHeader columnKey="dueDate" title="الاستحقاق" config={taskSortConfig} requestSortFn={requestTaskSort} />
                                        <SortableHeader columnKey="priority" title="الأولوية" config={taskSortConfig} requestSortFn={requestTaskSort} />
                                        <SortableHeader columnKey="status" title="الحالة" config={taskSortConfig} requestSortFn={requestTaskSort} />
                                        <TableHead>الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTasks.length > 0 ? sortedTasks.map(task => (
                                        <TableRow key={task.id}>
                                            <TableCell className="text-foreground">{task.description}</TableCell>
                                            <TableCell className="text-muted-foreground">{task.dueDate ? formatDateEn(task.dueDate) : '-'}</TableCell>
                                            <TableCell className="text-muted-foreground">{task.priority === 'low' ? 'منخفضة' : task.priority === 'medium' ? 'متوسطة' : 'عالية'}</TableCell>
                                            <TableCell>
                                                 <Select value={task.status} onValueChange={(newStatus) => task.id && updateTaskStatus(task.id, newStatus as TaskStatus)}>
                                                    <SelectTrigger className="text-xs w-[140px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{Object.entries(TASK_STATUSES).map(([key, value]) => (<SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>))}</SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => task.id && deleteTask(task.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد مهام لهذا الشهر.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                 </div>
            </TabsContent>
        </Tabs>

        <Card className="mt-8 shadow-lg border border-purple-200 dark:border-purple-700 rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-900/20">
            <CardHeader className="bg-purple-100 dark:bg-purple-800/30">
                <CardTitle className="text-xl text-purple-800 dark:text-purple-300 flex items-center">
                    <Brain className="mr-2 h-6 w-6 rtl:ml-2 rtl:mr-0" />
                    التحليل المالي بواسطة الذكاء الاصطناعي
                </CardTitle>
                <CardDescription className="text-purple-700 dark:text-purple-400 mt-1">
                    احصل على تحليل لبياناتك المالية (الدخل والمصروفات) ومقارنتها عبر الشهور بواسطة نموذج لغوي متقدم.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Button onClick={handleAnalyzeFinancials} disabled={isAnalyzingFinancials || rateLoading || !exchangeRates} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
                    {isAnalyzingFinancials ? <><Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" /> جاري التحليل...</> : <><BarChartBig className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" /> تحليل البيانات الآن</>}
                </Button>
                {rateLoading && <p className="text-sm text-muted-foreground mt-2">يرجى الانتظار حتى يتم تحميل أسعار الصرف...</p>}
                {!rateLoading && !exchangeRates && rateError && <p className="text-sm text-destructive mt-2">لا يمكن إجراء التحليل بسبب خطأ في تحميل أسعار الصرف.</p>}

                {financialAnalysisResult && !isAnalyzingFinancials && (
                    <div className="mt-6 space-y-4 text-sm">
                        <div>
                            <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-300 mb-1">التقييم العام:</h3>
                            <p className="text-foreground whitespace-pre-wrap">{financialAnalysisResult.overallAssessment_ar}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-300 mb-1">أداء الشهر الحالي ({format(selectedDate, "MMMM yyyy", { locale: arSA })}):</h3>
                            <p className="text-foreground whitespace-pre-wrap">{financialAnalysisResult.currentMonthPerformance_ar}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-300 mb-1">التحليل المقارن:</h3>
                            <p className="text-foreground whitespace-pre-wrap">{financialAnalysisResult.comparativeAnalysis_ar}</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-300 mb-1">الاتجاهات الرئيسية:</h3>
                            <ul className="list-disc pl-5 space-y-1 text-foreground rtl:pr-5 rtl:pl-0">
                                {financialAnalysisResult.keyTrends_ar.map((trend, index) => <li key={index} className="whitespace-pre-wrap">{trend}</li>)}
                            </ul>
                        </div>
                        {financialAnalysisResult.potentialFocusAreas_ar && financialAnalysisResult.potentialFocusAreas_ar.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg text-purple-700 dark:text-purple-300 mb-1">نقاط للتركيز عليها:</h3>
                                <ul className="list-disc pl-5 space-y-1 text-foreground rtl:pr-5 rtl:pl-0">
                                    {financialAnalysisResult.potentialFocusAreas_ar.map((area, index) => <li key={index} className="whitespace-pre-wrap">{area}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {financialAnalysisError && !isAnalyzingFinancials && (
                    <Alert variant="destructive" className="mt-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>خطأ في التحليل</AlertTitle>
                        <AlertDescription>{financialAnalysisError}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>

        <Card className="mt-8 shadow-lg border border-green-200 dark:border-green-700 rounded-lg overflow-hidden bg-green-50 dark:bg-green-900/20">
            <CardHeader className="bg-green-100 dark:bg-green-800/30">
                <CardTitle className="text-xl text-green-800 dark:text-green-300 flex items-center">
                    <Coins className="mr-2 h-6 w-6 rtl:ml-2 rtl:mr-0" />
                    حساب زكاة المال (تقديري لشهر {format(selectedDate, "MMMM yyyy", { locale: arSA })})
                </CardTitle>
                 <CardDescription className="text-green-700 dark:text-green-400 mt-1">
                    الزكاة تحسب بنسبة 2.5% من صافي الثروة (الدخل بالدولار - الديون بالدولار - المصروفات بالدولار)، ثم تحول للجنيه. هذا حساب تقديري للشهر المحدد.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {rateLoading ? <div className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2 rtl:ml-2 rtl:mr-0" />جاري تحميل...</div> : rateError || !exchangeRates || !exchangeRates.EGP ? <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>خطأ</AlertTitle><AlertDescription>لا يمكن حساب الزكاة (خطأ في سعر الصرف).</AlertDescription></Alert> : netWealthForZakatUSD !== null && netWealthForZakatUSD > 0 && zakatAmountEGP !== null ? (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div><p className="text-sm text-muted-foreground">إجمالي الدخل (دولار):</p><p className="text-lg font-semibold text-green-700 dark:text-green-400">{formatCurrency(totalPaidUSD, 'USD')}</p></div>
                            <div><p className="text-sm text-muted-foreground">إجمالي الديون (دولار):</p><p className="text-lg font-semibold text-red-700 dark:text-red-400">{formatCurrency(totalOutstandingDebtUSD, 'USD')}</p></div>
                            <div><p className="text-sm text-muted-foreground">إجمالي المصروفات (دولار):</p><p className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(totalExpensesUSD, 'USD')}</p></div>
                        </div>
                         <div className="mb-4"><p className="text-sm text-muted-foreground">صافي الثروة (دولار):</p><p className="text-lg font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(netWealthForZakatUSD, 'USD')}</p></div>
                         <div className="mb-2"><p className="text-sm text-muted-foreground">سعر الصرف (دولار/جنيه):</p><p className="text-lg font-semibold text-foreground">1 USD = {exchangeRates.EGP.toLocaleString('en-US', {minimumFractionDigits: 2})} EGP</p></div>
                        <div className="border-t pt-4 mt-4"><p className="text-md text-foreground">مبلغ الزكاة (جنيه مصري):</p><p className="text-2xl font-bold text-primary">{formatCurrency(zakatAmountEGP, 'EGP')}</p><p className="text-xs mt-1 text-muted-foreground">(25 جنيه عن كل 1000 جنيه صافي)</p></div>
                    </div>
                ) : ( <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300"><AlertCircle className="h-4 w-4"/><AlertTitle>لا زكاة مستحقة</AlertTitle><AlertDescription>صافي الثروة أقل من الصفر أو لا بيانات كافية.</AlertDescription></Alert> )}
            </CardContent>
        </Card>
    </div>
  );
};

export default ClientTracker;

