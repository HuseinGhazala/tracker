
'use client';

import * as React from 'react';
import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale'; // Import Arabic locale
import { CalendarIcon, ArrowUpDown, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ClientPaymentChart, type ChartData } from '@/components/client-payment-chart'; // Import chart component
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Define the schema for client data with Arabic error messages
const clientSchema = z.object({
  id: z.string().optional(), // Optional for new clients, required for existing
  name: z.string().min(1, { message: 'اسم العميل مطلوب.' }),
  project: z.string().min(1, { message: 'وصف المشروع مطلوب.' }),
  payment: z.coerce.number().positive({ message: 'يجب أن يكون المبلغ المدفوع (بالجنيه المصري) رقمًا موجبًا.' }), // Input is now EGP
  date: z.date({ required_error: 'تاريخ الدفعة مطلوب.' }),
});

type Client = z.infer<typeof clientSchema>;

// Local storage key
const LOCAL_STORAGE_KEY = 'clientTrackerData';
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/EGP'; // Free API for EGP rates

const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Client | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false); // Track mount state
  const [exchangeRate, setExchangeRate] = useState<number | null>(null); // EGP to USD rate
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState<string | null>(null);

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchRate = async () => {
      setRateLoading(true);
      setRateError(null);
      try {
        const response = await fetch(EXCHANGE_RATE_API_URL);
        if (!response.ok) {
          throw new Error(`فشل جلب سعر الصرف: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.result === 'success' && data.rates && data.rates.USD) {
          setExchangeRate(data.rates.USD);
        } else {
          throw new Error('تنسيق بيانات سعر الصرف غير صالح.');
        }
      } catch (error: any) {
        console.error("Failed to fetch exchange rate:", error);
        setRateError(error.message || 'حدث خطأ غير متوقع أثناء جلب سعر الصرف.');
        // Use a fallback rate if API fails? For now, just show error.
        setExchangeRate(null); // Indicate rate is unavailable
      } finally {
        setRateLoading(false);
      }
    };

    fetchRate();
  }, []);


  // Load clients from local storage on initial render after mount
  useEffect(() => {
    setIsMounted(true); // Component is mounted
    const storedClients = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedClients) {
      try {
        const parsedClients = JSON.parse(storedClients).map((client: any) => ({
          ...client,
          payment: typeof client.payment === 'number' ? client.payment : 0, // Ensure payment is number
          date: new Date(client.date), // Ensure date is a Date object
        }));
        setClients(parsedClients);
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
      payment: 0, // EGP
      date: undefined, // Initialize date as undefined
    },
  });

  function onSubmit(values: Client) {
    const newClient = { ...values, id: crypto.randomUUID() }; // Generate a unique ID
    setClients((prevClients) => [...prevClients, newClient]);
    toast({
      title: 'تمت إضافة العميل',
      description: `${values.name} تمت إضافته بنجاح.`,
    });
    form.reset(); // Reset form fields after submission
    form.setValue('date', undefined as any);
  }

  const deleteClient = (idToDelete: string) => {
    setClients((prevClients) => prevClients.filter(client => client.id !== idToDelete));
    toast({
      title: 'تم حذف العميل',
      description: `تمت إزالة سجل العميل.`,
      variant: 'destructive',
    });
  };

  const requestSort = (key: keyof Client) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedClients = useMemo(() => {
    if (!isMounted) return []; // Return empty array during SSR or before mount
    return [...clients].sort((a, b) => {
      if (!sortConfig.key) return 0;

      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

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
  }, [clients, sortConfig, isMounted]); // Depend on isMounted

  const SortableHeader = ({ columnKey, title }: { columnKey: keyof Client, title: string }) => (
    <TableHead onClick={() => requestSort(columnKey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {title}
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </TableHead>
  );

   // Format currency
   const formatCurrency = (amount: number, currency: 'EGP' | 'USD') => {
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    };
    // Use 'en-US' locale for USD for standard formatting, 'ar-EG' for EGP
    const locale = currency === 'USD' ? 'en-US' : 'ar-EG';
    try {
        return amount.toLocaleString(locale, options);
    } catch (e) {
        // Fallback for environments with limited locale support
        return `${currency} ${amount.toFixed(2)}`;
    }
   };

   // Convert EGP to USD
   const convertToUSD = (egpAmount: number): number | null => {
     if (exchangeRate === null || rateLoading) return null;
     return egpAmount * exchangeRate;
   };

  const totalPaymentEGP = useMemo(() => {
      if (!isMounted) return 0; // Return 0 during SSR or before mount
      return sortedClients.reduce((sum, client) => sum + (client.payment || 0), 0);
  }, [sortedClients, isMounted]);

  const totalPaymentUSD = useMemo(() => {
    if (!isMounted || exchangeRate === null || rateLoading) return null;
    return convertToUSD(totalPaymentEGP);
  }, [totalPaymentEGP, exchangeRate, isMounted, rateLoading]);


  // Process data for the chart (in USD)
  const chartData: ChartData[] | null = useMemo(() => {
    if (!isMounted || rateLoading || exchangeRate === null) return null; // Return null if rate not ready

    const monthlyTotalsUSD: { [key: string]: number } = {};

    sortedClients.forEach(client => {
      const monthYear = format(client.date, 'yyyy-MM', { locale: arSA }); // Group by year-month
      const paymentUSD = convertToUSD(client.payment);

      if (paymentUSD !== null) {
          if (!monthlyTotalsUSD[monthYear]) {
            monthlyTotalsUSD[monthYear] = 0;
          }
          monthlyTotalsUSD[monthYear] += paymentUSD;
      }
    });

    // Convert to chart data format and sort by month
    return Object.entries(monthlyTotalsUSD)
      .map(([monthYear, total]) => ({ monthYear, total }))
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear)) // Sort by YYYY-MM string
      .map(({ monthYear, total }) => {
        const date = new Date(monthYear + '-01');
        const monthName = format(date, 'MMMM yyyy', { locale: arSA });
        return { month: monthName, total }; // Total is now in USD
      });

  }, [sortedClients, isMounted, exchangeRate, rateLoading]);


  if (!isMounted) {
    // Render a loading state or null during SSR/pre-mount
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">متتبع العملاء</h1>

        {/* Exchange Rate Info/Error */}
         {rateLoading && (
            <Alert className="mb-4 bg-blue-100 border-blue-300 text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>جاري جلب سعر الصرف...</AlertTitle>
            </Alert>
          )}
          {rateError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>خطأ في سعر الصرف</AlertTitle>
              <AlertDescription>{rateError}</AlertDescription>
            </Alert>
          )}
          {exchangeRate !== null && !rateLoading && (
            <Alert className="mb-4 bg-green-100 border-green-300 text-green-800">
               <AlertTitle>سعر الصرف الحالي</AlertTitle>
               <AlertDescription>1 جنيه مصري = {formatCurrency(exchangeRate, 'USD')}</AlertDescription>
             </Alert>
          )}


      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle>إضافة عميل جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="payment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المبلغ المدفوع (بالجنيه المصري)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="أدخل المبلغ بالجنيه المصري" {...field} step="0.01"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
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
             <CardTitle>الدخل الشهري (بالدولار الأمريكي)</CardTitle>
           </CardHeader>
           <CardContent className="pl-2"> {/* Adjusted padding for chart */}
             <ClientPaymentChart data={chartData} />
           </CardContent>
         </Card>
       )}
       {chartData === null && !rateLoading && rateError && (
          <Alert variant="destructive" className="mb-8">
            <AlertTitle>لا يمكن عرض الرسم البياني</AlertTitle>
            <AlertDescription>تعذر تحميل الرسم البياني للدخل بسبب خطأ في جلب سعر الصرف.</AlertDescription>
          </Alert>
       )}


      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>سجلات العملاء</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>قائمة بعملائك لهذا الشهر.</TableCaption>
            <TableHeader>
              <TableRow>
                <SortableHeader columnKey="name" title="اسم العميل" />
                <SortableHeader columnKey="project" title="المشروع" />
                <TableHead>الدفعة (جنيه)</TableHead>
                <TableHead>الدفعة (دولار)</TableHead>
                <SortableHeader columnKey="date" title="التاريخ" />
                <TableHead className="text-left">الإجراءات</TableHead> {/* Adjusted alignment for RTL */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length > 0 ? (
                sortedClients.map((client) => {
                    const paymentUSD = convertToUSD(client.payment);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.project}</TableCell>
                        <TableCell>{formatCurrency(client.payment, 'EGP')}</TableCell>
                        <TableCell>
                            {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                             paymentUSD !== null ? formatCurrency(paymentUSD, 'USD') :
                             rateError ? <span className="text-destructive text-xs">خطأ</span> : '-'}
                        </TableCell>
                        <TableCell>{format(client.date, 'PPP', { locale: arSA })}</TableCell> {/* Use Arabic locale */}
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    لم تتم إضافة عملاء بعد.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">المجموع</TableCell>
                  <TableCell className="font-semibold">
                     {formatCurrency(totalPaymentEGP, 'EGP')}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     totalPaymentUSD !== null ? formatCurrency(totalPaymentUSD, 'USD') :
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

    