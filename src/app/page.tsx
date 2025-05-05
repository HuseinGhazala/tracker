
'use client';

import * as React from 'react';
import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale'; // Import Arabic locale
import { CalendarIcon, ArrowUpDown, Trash2, Loader2, AlertCircle } from 'lucide-react';

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
} from "@/components/ui/select"
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ClientPaymentChart, type ChartData } from '@/components/client-payment-chart'; // Import chart component
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Define constants for payment status and currency
const PAYMENT_STATUSES = {
  paid: 'تم الدفع',
  partially_paid: 'دفع جزئي',
  not_paid: 'لم يتم الدفع',
} as const;
type PaymentStatus = keyof typeof PAYMENT_STATUSES;

const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;
type Currency = keyof typeof CURRENCIES;

// Define the schema for client data with Arabic error messages
const clientSchema = z.object({
  id: z.string().optional(), // Optional for new clients, required for existing
  name: z.string().min(1, { message: 'اسم العميل مطلوب.' }),
  project: z.string().min(1, { message: 'وصف المشروع مطلوب.' }),
  totalProjectCost: z.coerce.number().positive({ message: 'يجب أن تكون التكلفة الإجمالية رقمًا موجبًا.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'العملة مطلوبة.' }),
  paymentStatus: z.enum(Object.keys(PAYMENT_STATUSES) as [PaymentStatus, ...PaymentStatus[]], { required_error: 'حالة الدفع مطلوبة.' }),
  amountPaidSoFar: z.coerce.number().nonnegative({ message: 'المبلغ المدفوع يجب أن يكون صفر أو أكثر.' }).optional(),
  paymentDate: z.date().optional(),
}).refine(data => {
  // Require paymentDate if status is paid or partially_paid
  if ((data.paymentStatus === 'paid' || data.paymentStatus === 'partially_paid') && !data.paymentDate) {
    return false;
  }
  return true;
}, {
  message: 'تاريخ الدفع مطلوب عندما تكون الحالة "تم الدفع" أو "دفع جزئي".',
  path: ['paymentDate'],
}).refine(data => {
    // Require amountPaidSoFar if status is paid or partially_paid
    if ((data.paymentStatus === 'paid' || data.paymentStatus === 'partially_paid') && (data.amountPaidSoFar === undefined || data.amountPaidSoFar === null)) {
      return false;
    }
    return true;
  }, {
    message: 'المبلغ المدفوع مطلوب عندما تكون الحالة "تم الدفع" أو "دفع جزئي".',
    path: ['amountPaidSoFar'],
}).refine(data => {
    // amountPaidSoFar should not exceed totalProjectCost
    if (data.amountPaidSoFar !== undefined && data.amountPaidSoFar !== null && data.amountPaidSoFar > data.totalProjectCost) {
        return false;
    }
    return true;
},{
    message: 'المبلغ المدفوع لا يمكن أن يتجاوز التكلفة الإجمالية للمشروع.',
    path: ['amountPaidSoFar'],
}).refine(data => {
    // If paid, amountPaidSoFar must equal totalProjectCost
    if (data.paymentStatus === 'paid' && data.amountPaidSoFar !== data.totalProjectCost) {
        return false;
    }
    return true;
},{
    message: 'في حالة "تم الدفع"، يجب أن يساوي المبلغ المدفوع التكلفة الإجمالية للمشروع.',
    path: ['amountPaidSoFar'],
});


type Client = z.infer<typeof clientSchema>;

// Local storage key
const LOCAL_STORAGE_KEY = 'clientTrackerDataV2'; // Changed key for new structure
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'; // Fetch rates relative to USD

// Type for exchange rates (USD to Other)
type ExchangeRates = {
    [key in Currency]?: number;
};

const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Client | 'remainingAmount' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false); // Track mount state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null); // USD to OTHER rates
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState<string | null>(null);

  // Fetch exchange rates on mount
  useEffect(() => {
    const fetchRates = async () => {
      setRateLoading(true);
      setRateError(null);
      try {
        const response = await fetch(EXCHANGE_RATE_API_URL);
        if (!response.ok) {
          throw new Error(`فشل جلب أسعار الصرف: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.result === 'success' && data.rates) {
          // Extract needed rates (USD is base)
          const rates: ExchangeRates = { USD: 1 }; // 1 USD = 1 USD
          for (const currencyCode of Object.keys(CURRENCIES)) {
              if (currencyCode !== 'USD' && data.rates[currencyCode]) {
                  rates[currencyCode as Currency] = data.rates[currencyCode];
              }
          }
           // Check if all required currencies were found
          const missingCurrencies = Object.keys(CURRENCIES).filter(
             (c) => !rates[c as Currency]
           );
           if (missingCurrencies.length > 0) {
               console.warn(`Rates not found for: ${missingCurrencies.join(', ')}`);
               // Optionally set an error or use default rates
           }

          setExchangeRates(rates);
        } else {
          throw new Error('تنسيق بيانات سعر الصرف غير صالح.');
        }
      } catch (error: any) {
        console.error("Failed to fetch exchange rates:", error);
        setRateError(error.message || 'حدث خطأ غير متوقع أثناء جلب أسعار الصرف.');
        setExchangeRates(null); // Indicate rates are unavailable
      } finally {
        setRateLoading(false);
      }
    };

    fetchRates();
  }, []);


  // Load clients from local storage on initial render after mount
  useEffect(() => {
    setIsMounted(true); // Component is mounted
    const storedClients = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedClients) {
      try {
        const parsedClients = JSON.parse(storedClients).map((client: any) => ({
          ...client,
          totalProjectCost: typeof client.totalProjectCost === 'number' ? client.totalProjectCost : 0,
          amountPaidSoFar: typeof client.amountPaidSoFar === 'number' ? client.amountPaidSoFar : undefined,
          paymentDate: client.paymentDate ? new Date(client.paymentDate) : undefined, // Ensure date is a Date object or undefined
          currency: client.currency || 'EGP', // Default to EGP if missing
          paymentStatus: client.paymentStatus || 'not_paid', // Default to not_paid if missing
        }));
        // Basic validation after parsing (optional but recommended)
        const validatedClients = parsedClients.filter((client: any) => {
            try {
                clientSchema.parse(client);
                return true;
            } catch (e) {
                console.warn("Invalid client data found in storage:", client, e);
                return false;
            }
        });
        setClients(validatedClients);
      } catch (error) {
        console.error("Failed to parse clients from local storage:", error);
        // localStorage.removeItem(LOCAL_STORAGE_KEY); // Avoid removing potentially recoverable data
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  // Save clients to local storage whenever the clients state changes, only after mount
  useEffect(() => {
    if (isMounted) { // Only run after component has mounted
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clients));
    }
  }, [clients, isMounted]);


  const form = useForm<Client>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      project: '',
      totalProjectCost: 0,
      currency: 'EGP',
      paymentStatus: 'not_paid',
      amountPaidSoFar: undefined,
      paymentDate: undefined,
    },
  });

  // Watch form fields to react to changes
  const paymentStatus = form.watch('paymentStatus');
  const selectedCurrency = form.watch('currency');
  const totalProjectCost = form.watch('totalProjectCost');
  const amountPaidSoFar = form.watch('amountPaidSoFar');


  // Reset conditional fields when paymentStatus changes
  useEffect(() => {
    if (paymentStatus === 'not_paid') {
      form.setValue('amountPaidSoFar', undefined);
      form.setValue('paymentDate', undefined);
      form.clearErrors(['amountPaidSoFar', 'paymentDate']); // Clear potential errors
    } else if (paymentStatus === 'paid') {
        // Optionally set amountPaidSoFar to totalProjectCost if status is 'paid'
         const totalCost = form.getValues('totalProjectCost');
         if (totalCost > 0) {
             form.setValue('amountPaidSoFar', totalCost);
         }
    }
    // For 'partially_paid', fields are required but not auto-filled
  }, [paymentStatus, form]);


  function onSubmit(values: Client) {
      let finalValues = { ...values };

      // Ensure amountPaidSoFar is 0 if status is 'not_paid'
      if (finalValues.paymentStatus === 'not_paid') {
          finalValues.amountPaidSoFar = 0;
          finalValues.paymentDate = undefined; // Ensure date is also cleared
      }
      // Ensure amountPaidSoFar equals totalProjectCost if status is 'paid'
      else if (finalValues.paymentStatus === 'paid') {
          finalValues.amountPaidSoFar = finalValues.totalProjectCost;
      }

      const newClient = { ...finalValues, id: crypto.randomUUID() }; // Generate a unique ID

      setClients((prevClients) => [...prevClients, newClient]);
      toast({
        title: 'تمت إضافة العميل',
        description: `${values.name} تمت إضافته بنجاح.`,
      });
      form.reset(); // Reset form fields after submission
  }


  const deleteClient = (idToDelete: string) => {
    setClients((prevClients) => prevClients.filter(client => client.id !== idToDelete));
    toast({
      title: 'تم حذف العميل',
      description: `تمت إزالة سجل العميل.`,
      variant: 'destructive',
    });
  };

   // Convert any currency to USD
   const convertToUSD = (amount: number, fromCurrency: Currency): number | null => {
       if (rateLoading || !exchangeRates) return null;
       const rateToUSD = exchangeRates[fromCurrency];
       if (!rateToUSD) {
           console.warn(`Exchange rate not available for ${fromCurrency}`);
           return null; // Rate not available
       }
       if (fromCurrency === 'USD') return amount;
       // Since API gives USD to OTHER, we need OTHER to USD = 1 / (USD to OTHER)
       // But our API gives USD to OTHER. We need X to USD.
       // Rate is USD per 1 unit of base (USD). So exchangeRates['EUR'] = 0.9 EUR per 1 USD.
       // To convert EUR to USD: AmountEUR / RateEUR_per_USD = AmountUSD
       const rateUSD_per_X = exchangeRates[fromCurrency];
       if (!rateUSD_per_X) return null; // Should not happen if checked before

       // The API gives rates relative to USD. So data.rates.EGP is EGP per 1 USD.
       // To convert EGP to USD: amount EGP / (EGP per 1 USD) = amount USD
       return amount / rateUSD_per_X;
   };


  const requestSort = (key: keyof Client | 'remainingAmount') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const calculateRemainingAmount = (client: Partial<Client>): number => {
      if (!client.totalProjectCost || client.totalProjectCost <= 0) return 0;
      if (client.paymentStatus === 'paid') return 0;
      const paid = client.amountPaidSoFar ?? 0;
      return Math.max(0, client.totalProjectCost - paid);
  };


  const sortedClients = useMemo(() => {
    if (!isMounted) return []; // Return empty array during SSR or before mount

    return [...clients].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue, bValue;

        if (sortConfig.key === 'remainingAmount') {
            aValue = calculateRemainingAmount(a);
            bValue = calculateRemainingAmount(b);
        } else {
            aValue = a[sortConfig.key as keyof Client];
            bValue = b[sortConfig.key as keyof Client];
        }

        // Handle undefined/null values consistently
        const aHasValue = aValue !== undefined && aValue !== null;
        const bHasValue = bValue !== undefined && bValue !== null;

        if (!aHasValue && !bHasValue) return 0;
        if (!aHasValue) return sortConfig.direction === 'ascending' ? 1 : -1; // Sort undefined/null to the end
        if (!bHasValue) return sortConfig.direction === 'ascending' ? -1 : 1; // Sort undefined/null to the end


        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
        } else {
            // Use localeCompare for string sorting, respecting Arabic characters
            comparison = String(aValue).localeCompare(String(bValue), 'ar');
        }
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
}, [clients, sortConfig, isMounted]);


  const SortableHeader = ({ columnKey, title }: { columnKey: keyof Client | 'remainingAmount', title: string }) => (
    <TableHead onClick={() => requestSort(columnKey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {title}
        {sortConfig.key === columnKey && (
          <ArrowUpDown className={`h-4 w-4 text-foreground transform ${sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
        )}
        {sortConfig.key !== columnKey && (
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

   // Format currency
   const formatCurrency = (amount: number | null | undefined, currency: Currency) => {
    if (amount === null || amount === undefined) return '-';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    };
     // Use appropriate locales for formatting
    const localeMap: { [key in Currency]: string } = {
        EGP: 'ar-EG',
        SAR: 'ar-SA',
        USD: 'en-US',
        CAD: 'en-CA',
        EUR: 'de-DE', // Example locale for Euro, adjust as needed
    };
    const locale = localeMap[currency] || 'en-US'; // Fallback locale

    try {
        // Handle potential negative zero for display
        const displayAmount = Object.is(amount, -0) ? 0 : amount;
        return displayAmount.toLocaleString(locale, options);
    } catch (e) {
        // Fallback for environments with limited locale support
        console.warn(`Locale formatting failed for ${currency} with locale ${locale}:`, e);
        // Basic fallback
        const symbols: { [key in Currency]: string } = { EGP: 'EGP', SAR: 'SAR', USD: '$', CAD: 'CA$', EUR: '€' };
        return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    }
   };


  const totalPaidUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return sortedClients.reduce((sum, client) => {
          const paidAmount = client.amountPaidSoFar ?? 0;
          const amountInUSD = convertToUSD(paidAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
  }, [sortedClients, isMounted, exchangeRates, rateLoading]);

    const totalRemainingUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return sortedClients.reduce((sum, client) => {
          const remainingAmount = calculateRemainingAmount(client);
          const amountInUSD = convertToUSD(remainingAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
    }, [sortedClients, isMounted, exchangeRates, rateLoading]);


  // Process data for the chart (in USD)
  const chartData: ChartData[] | null = useMemo(() => {
    if (!isMounted || rateLoading || !exchangeRates) return null; // Return null if rates not ready

    const monthlyTotalsUSD: { [key: string]: number } = {};

    sortedClients.forEach(client => {
      if ((client.paymentStatus === 'paid' || client.paymentStatus === 'partially_paid') && client.paymentDate) {
            const monthYear = format(client.paymentDate, 'yyyy-MM', { locale: arSA }); // Group by year-month
            // We need to track the *change* in amount paid *in that month*.
            // This simple approach sums all payments made up to that month, which might not be accurate for a monthly income chart.
            // A more accurate approach requires tracking individual payments, not just total paid so far.
            // For simplicity, we'll sum the amountPaidSoFar for clients whose *last* payment date falls in the month.
            // This is an approximation.

            // Let's sum the *entire* amountPaidSoFar if the paymentDate is in this month.
            // This assumes paymentDate reflects the *last* payment.
            const paymentUSD = convertToUSD(client.amountPaidSoFar ?? 0, client.currency);

            if (paymentUSD !== null) {
                if (!monthlyTotalsUSD[monthYear]) {
                    monthlyTotalsUSD[monthYear] = 0;
                }
                 // This logic is flawed for monthly income. It sums the *total* paid by a client in the month of their *last* recorded payment.
                 // A better approach needs payment history.
                 // Sticking with the current (flawed) logic for now:
                monthlyTotalsUSD[monthYear] += paymentUSD;
            }
      }
    });

    // Convert to chart data format and sort by month
    return Object.entries(monthlyTotalsUSD)
      .map(([monthYear, total]) => ({ monthYear, total }))
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear)) // Sort by YYYY-MM string
      .map(({ monthYear, total }) => {
        // Ensure date parsing is robust
        const [year, month] = monthYear.split('-').map(Number);
        const date = new Date(year, month - 1, 1); // Month is 0-indexed
        const monthName = format(date, 'MMMM yyyy', { locale: arSA });
        return { month: monthName, total }; // Total is now in USD
      });

  }, [sortedClients, isMounted, exchangeRates, rateLoading]);


  if (!isMounted) {
    // Render a loading state or null during SSR/pre-mount
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const remainingAmountInForm = calculateRemainingAmount({
    totalProjectCost: totalProjectCost,
    amountPaidSoFar: amountPaidSoFar,
    paymentStatus: paymentStatus
  });

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">متتبع العملاء</h1>

        {/* Exchange Rate Info/Error */}
         {rateLoading && (
            <Alert className="mb-4 bg-blue-100 border-blue-300 text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>جاري جلب أسعار الصرف...</AlertTitle>
            </Alert>
          )}
          {rateError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4"/>
              <AlertTitle>خطأ في سعر الصرف</AlertTitle>
              <AlertDescription>{rateError} لا يمكن حساب القيم بالدولار الأمريكي.</AlertDescription>
            </Alert>
          )}
          {exchangeRates && !rateLoading && (
            <Alert className="mb-4 bg-green-100 border-green-300 text-green-800">
               <AlertTitle>أسعار الصرف (مقابل 1 دولار أمريكي)</AlertTitle>
               <AlertDescription>
                 <ul className="list-disc list-inside">
                   {Object.entries(exchangeRates).map(([currency, rate]) => (
                     <li key={currency}>
                       {CURRENCIES[currency as Currency] || currency}: {rate?.toFixed(4)}
                     </li>
                   ))}
                 </ul>
               </AlertDescription>
             </Alert>
          )}


      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle>إضافة عميل جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6"> {/* Increased space */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Increased gap */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم العميل</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل اسم العميل" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>وصف المشروع</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل تفاصيل المشروع" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="totalProjectCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>التكلفة الإجمالية للمشروع</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="أدخل التكلفة الإجمالية" {...field} step="0.01"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>العملة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر العملة" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {Object.entries(CURRENCIES).map(([code, name]) => (
                                <SelectItem key={code} value={code}>{name} ({code})</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                <FormField
                    control={form.control}
                    name="paymentStatus"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>حالة الدفع</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر حالة الدفع" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {Object.entries(PAYMENT_STATUSES).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                {/* Conditional Fields based on Payment Status */}
                 {(paymentStatus === 'paid' || paymentStatus === 'partially_paid') && (
                    <>
                       <FormField
                            control={form.control}
                            name="amountPaidSoFar"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>
                                    المبلغ المدفوع حتى الآن
                                    {paymentStatus === 'paid' && <span className='text-muted-foreground text-xs'> (يجب أن يساوي التكلفة الإجمالية)</span>}
                                    </FormLabel>
                                <FormControl>
                                    <Input
                                    type="number"
                                    placeholder="أدخل المبلغ المدفوع"
                                    {...field}
                                    step="0.01"
                                    // Disable if 'paid' to enforce equality with total cost
                                    // disabled={paymentStatus === 'paid'}
                                    value={field.value ?? ''} // Ensure value is controlled, handle undefined
                                    onChange={(e) => {
                                        // Allow clearing the field, parse otherwise
                                        const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        field.onChange(value);
                                    }}
                                    />
                                </FormControl>
                                 {/* Show remaining amount hint for partially paid */}
                                 {paymentStatus === 'partially_paid' && amountPaidSoFar !== undefined && amountPaidSoFar !== null && totalProjectCost > 0 && (
                                     <FormDescription className="text-sm text-muted-foreground pt-1">
                                         المبلغ المتبقي: {formatCurrency(remainingAmountInForm, selectedCurrency)}
                                     </FormDescription>
                                 )}
                                <FormMessage />
                                </FormItem>
                            )}
                       />
                        <FormField
                            control={form.control}
                            name="paymentDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel className="mb-2">تاريخ الدفعة</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={'outline'}
                                        className={cn(
                                            'w-full pr-3 text-right font-normal', // Adjusted text alignment for RTL
                                            !field.value && 'text-muted-foreground'
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, 'PPP', { locale: arSA }) // Use Arabic locale
                                        ) : (
                                            <span>اختر تاريخًا</span>
                                        )}
                                        <CalendarIcon className="mr-auto h-4 w-4 opacity-50" /> {/* Adjusted margin for RTL */}
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date > new Date() || date < new Date('1900-01-01')
                                        }
                                        initialFocus
                                        locale={arSA} // Set locale for Calendar
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                     </>
                 )}

              </div>
              <Button type="submit" className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">إضافة عميل</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

       {/* Payment Chart Card (USD) */}
       {chartData && chartData.length > 0 && (
         <Card className="mb-8 shadow-md">
           <CardHeader>
             <CardTitle>الدخل الشهري (بالدولار الأمريكي - تقديري)</CardTitle>
              <AlertDescription>ملاحظة: الرسم البياني يمثل الدخل الشهري بشكل تقديري بناءً على تاريخ آخر دفعة مسجلة لكل عميل والمبلغ الإجمالي المدفوع حتى ذلك التاريخ. للحصول على دقة أعلى، يجب تتبع الدفعات الفردية.</AlertDescription>
           </CardHeader>
           <CardContent className="pl-2"> {/* Adjusted padding for chart */}
             <ClientPaymentChart data={chartData} />
           </CardContent>
         </Card>
       )}
       {chartData === null && !rateLoading && rateError && (
          <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4"/>
            <AlertTitle>لا يمكن عرض الرسم البياني</AlertTitle>
            <AlertDescription>تعذر تحميل الرسم البياني للدخل بسبب خطأ في جلب سعر الصرف.</AlertDescription>
          </Alert>
       )}
       {chartData?.length === 0 && !rateLoading && !rateError && (
           <Alert className="mb-8">
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>لا توجد بيانات لعرضها</AlertTitle>
               <AlertDescription>لا توجد دفعات مسجلة لعرضها في الرسم البياني.</AlertDescription>
           </Alert>
       )}


      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>سجلات العملاء</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>قائمة بعملائك والمشاريع.</TableCaption>
            <TableHeader>
              <TableRow>
                <SortableHeader columnKey="name" title="اسم العميل" />
                <SortableHeader columnKey="project" title="المشروع" />
                <SortableHeader columnKey="totalProjectCost" title="التكلفة الإجمالية" />
                 <TableHead>العملة</TableHead>
                <SortableHeader columnKey="paymentStatus" title="حالة الدفع" />
                <SortableHeader columnKey="amountPaidSoFar" title="المدفوع" />
                <SortableHeader columnKey="remainingAmount" title="المتبقي" />
                <TableHead>المتبقي (دولار)</TableHead>
                <SortableHeader columnKey="paymentDate" title="تاريخ الدفع" />
                <TableHead className="text-left">الإجراءات</TableHead> {/* Adjusted alignment for RTL */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length > 0 ? (
                sortedClients.map((client) => {
                    const remainingAmount = calculateRemainingAmount(client);
                    const remainingAmountUSD = convertToUSD(remainingAmount, client.currency);
                    const amountPaid = client.amountPaidSoFar ?? 0;
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.project}</TableCell>
                        <TableCell>{formatCurrency(client.totalProjectCost, client.currency)}</TableCell>
                        <TableCell>{CURRENCIES[client.currency]}</TableCell>
                        <TableCell>
                             <span className={cn(
                                 "px-2 py-1 rounded-full text-xs font-medium",
                                 client.paymentStatus === 'paid' && 'bg-green-100 text-green-800',
                                 client.paymentStatus === 'partially_paid' && 'bg-yellow-100 text-yellow-800',
                                 client.paymentStatus === 'not_paid' && 'bg-red-100 text-red-800'
                             )}>
                                {PAYMENT_STATUSES[client.paymentStatus]}
                             </span>
                        </TableCell>
                         <TableCell>{formatCurrency(amountPaid, client.currency)}</TableCell>
                         <TableCell>{formatCurrency(remainingAmount, client.currency)}</TableCell>
                         <TableCell>
                            {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                             remainingAmountUSD !== null ? formatCurrency(remainingAmountUSD, 'USD') :
                             rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}
                         </TableCell>
                        <TableCell>{client.paymentDate ? format(client.paymentDate, 'PPP', { locale: arSA }) : '-'}</TableCell> {/* Use Arabic locale */}
                        <TableCell className="text-left"> {/* Adjusted alignment for RTL */}
                          <Button variant="ghost" size="icon" onClick={() => client.id && deleteClient(client.id)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    لم تتم إضافة عملاء بعد.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="font-semibold text-right">الإجمالي المتبقي (بالدولار الأمريكي)</TableCell>
                  <TableCell className="font-semibold">
                    {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     totalRemainingUSD !== null ? formatCurrency(totalRemainingUSD, 'USD') :
                     rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}
                  </TableCell>
                   <TableCell colSpan={2}></TableCell>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={7} className="font-semibold text-right">إجمالي المدفوع (بالدولار الأمريكي)</TableCell>
                  <TableCell className="font-semibold">
                    {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     totalPaidUSD !== null ? formatCurrency(totalPaidUSD, 'USD') :
                     rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}
                  </TableCell>
                   <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientTracker;

    