'use client';

import * as React from 'react'; // Ensure React is imported
import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, startOfMonth as dateFnsStartOfMonth, endOfMonth as dateFnsEndOfMonth, addDays } from 'date-fns'; // Import date-fns functions
import { arSA } from 'date-fns/locale'; // Import Arabic locale for date display only
import { CalendarIcon, ArrowUpDown, Trash2, Loader2, AlertCircle } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

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
import { Textarea } from '@/components/ui/textarea'; // Import Textarea

// Define constants for payment status and currency
const PAYMENT_STATUSES = {
  paid: 'تم الدفع',
  partially_paid: 'دفع جزئي',
  not_paid: 'لم يتم الدفع',
} as const;
type PaymentStatus = keyof typeof PAYMENT_STATUSES;

// Debt status
const DEBT_STATUSES = {
  outstanding: 'مستحق',
  paid: 'تم السداد',
  partially_paid: 'سداد جزئي',
} as const;
type DebtStatus = keyof typeof DEBT_STATUSES;


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

// Define the schema for debt data with Arabic error messages
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
}).refine(data => {
  // Require paidDate if status is paid or partially_paid
  if ((data.status === 'paid' || data.status === 'partially_paid') && !data.paidDate) {
    return false;
  }
  return true;
}, {
  message: 'تاريخ السداد مطلوب عندما تكون الحالة "تم السداد" أو "سداد جزئي".',
  path: ['paidDate'],
}).refine(data => {
  // Require amountRepaid if status is paid or partially_paid
  if ((data.status === 'paid' || data.status === 'partially_paid') && (data.amountRepaid === undefined || data.amountRepaid === null)) {
    return false;
  }
  return true;
}, {
  message: 'المبلغ المسدد مطلوب عندما تكون الحالة "تم السداد" أو "سداد جزئي".',
  path: ['amountRepaid'],
}).refine(data => {
  // amountRepaid should not exceed amount
  if (data.amountRepaid !== undefined && data.amountRepaid !== null && data.amountRepaid > data.amount) {
    return false;
  }
  return true;
}, {
  message: 'المبلغ المسدد لا يمكن أن يتجاوز مبلغ الدين الإجمالي.',
  path: ['amountRepaid'],
}).refine(data => {
  // If paid, amountRepaid must equal amount
  if (data.status === 'paid' && data.amountRepaid !== data.amount) {
    return false;
  }
  return true;
}, {
  message: 'في حالة "تم السداد"، يجب أن يساوي المبلغ المسدد مبلغ الدين الإجمالي.',
  path: ['amountRepaid'],
});

type Debt = z.infer<typeof debtSchema>;


// Local storage keys
const CLIENT_STORAGE_KEY = 'clientTrackerDataV2';
const DEBT_STORAGE_KEY = 'debtTrackerDataV1';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'; // Fetch rates relative to USD

// Type for exchange rates (USD to Other)
type ExchangeRates = {
    [key in Currency]?: number;
};

// Simple Exchange Rate Slider Component
const ExchangeRateSlider: FC<{ rates: ExchangeRates }> = ({ rates }) => {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 3000 })]);

  return (
    <Card className="mb-4 shadow-sm overflow-hidden bg-secondary text-secondary-foreground">
      <CardContent className="p-3">
        <div className="embla" ref={emblaRef}>
          <div className="embla__container flex">
            {Object.entries(rates).map(([currency, rate]) => (
              <div key={currency} className="embla__slide flex-grow-0 flex-shrink-0 basis-full min-w-0 text-center">
                {/* Display rate in English format */}
                <span className="font-semibold">1 USD</span> = <span className="font-semibold">{rate?.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span> {CURRENCIES[currency as Currency] || currency}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]); // State for debts
  const [clientSortConfig, setClientSortConfig] = useState<{ key: keyof Client | 'remainingAmount' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const [debtSortConfig, setDebtSortConfig] = useState<{ key: keyof Debt | 'remainingDebt' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
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


  // Load data from local storage on initial render after mount
  useEffect(() => {
    setIsMounted(true); // Component is mounted
    const storedClients = localStorage.getItem(CLIENT_STORAGE_KEY);
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
                // Check if paymentDate is valid before parsing
                if (client.paymentDate && isNaN(new Date(client.paymentDate).getTime())) {
                     console.warn("Invalid paymentDate found in storage for client:", client.id);
                     client.paymentDate = undefined; // Set to undefined if invalid
                }
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
      }
    }

    // Load debts
    const storedDebts = localStorage.getItem(DEBT_STORAGE_KEY);
    if (storedDebts) {
        try {
            const parsedDebts = JSON.parse(storedDebts).map((debt: any) => ({
                ...debt,
                amount: typeof debt.amount === 'number' ? debt.amount : 0,
                amountRepaid: typeof debt.amountRepaid === 'number' ? debt.amountRepaid : undefined,
                dueDate: debt.dueDate ? new Date(debt.dueDate) : new Date(), // Ensure valid date
                paidDate: debt.paidDate ? new Date(debt.paidDate) : undefined,
                currency: debt.currency || 'EGP',
                status: debt.status || 'outstanding',
            }));
            const validatedDebts = parsedDebts.filter((debt: any) => {
                try {
                     if ((debt.dueDate && isNaN(new Date(debt.dueDate).getTime()))) {
                         console.warn("Invalid dueDate found in storage for debt:", debt.id);
                         debt.dueDate = new Date(); // Set to today if invalid
                     }
                     if (debt.paidDate && isNaN(new Date(debt.paidDate).getTime())) {
                         console.warn("Invalid paidDate found in storage for debt:", debt.id);
                         debt.paidDate = undefined; // Set to undefined if invalid
                     }
                    debtSchema.parse(debt);
                    return true;
                } catch (e) {
                    console.warn("Invalid debt data found in storage:", debt, e);
                    return false;
                }
            });
            setDebts(validatedDebts);
        } catch (error) {
            console.error("Failed to parse debts from local storage:", error);
        }
    }

  }, []); // Empty dependency array ensures this runs once on mount

  // Save clients to local storage whenever the clients state changes, only after mount
  useEffect(() => {
    if (isMounted) { // Only run after component has mounted
        localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
    }
  }, [clients, isMounted]);

  // Save debts to local storage whenever the debts state changes, only after mount
  useEffect(() => {
    if (isMounted) { // Only run after component has mounted
        localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts));
    }
  }, [debts, isMounted]);

  // Client Form
  const clientForm = useForm<Client>({
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

  // Debt Form
  const debtForm = useForm<Debt>({
      resolver: zodResolver(debtSchema),
      defaultValues: {
          description: '',
          debtorName: '',
          creditorName: '',
          amount: 0,
          currency: 'EGP',
          dueDate: new Date(),
          status: 'outstanding',
          amountRepaid: undefined,
          paidDate: undefined,
          notes: '',
      },
  });


  // Watch client form fields
  const clientPaymentStatus = clientForm.watch('paymentStatus');
  const clientSelectedCurrency = clientForm.watch('currency');
  const clientTotalProjectCost = clientForm.watch('totalProjectCost');
  const clientAmountPaidSoFar = clientForm.watch('amountPaidSoFar');

  // Watch debt form fields
  const debtStatus = debtForm.watch('status');
  const debtAmount = debtForm.watch('amount');
  const debtAmountRepaid = debtForm.watch('amountRepaid');
  const debtSelectedCurrency = debtForm.watch('currency');


  // Reset conditional client fields when paymentStatus changes
  useEffect(() => {
    if (clientPaymentStatus === 'not_paid') {
      clientForm.setValue('amountPaidSoFar', undefined);
      clientForm.setValue('paymentDate', undefined);
      clientForm.clearErrors(['amountPaidSoFar', 'paymentDate']); // Clear potential errors
    } else if (clientPaymentStatus === 'paid') {
        // Optionally set amountPaidSoFar to totalProjectCost if status is 'paid'
         const totalCost = clientForm.getValues('totalProjectCost');
         if (totalCost > 0) {
             clientForm.setValue('amountPaidSoFar', totalCost);
         }
    }
    // For 'partially_paid', fields are required but not auto-filled
  }, [clientPaymentStatus, clientForm]);

  // Reset conditional debt fields when status changes
  useEffect(() => {
      if (debtStatus === 'outstanding') {
          debtForm.setValue('amountRepaid', undefined);
          debtForm.setValue('paidDate', undefined);
          debtForm.clearErrors(['amountRepaid', 'paidDate']);
      } else if (debtStatus === 'paid') {
          const totalAmount = debtForm.getValues('amount');
          if (totalAmount > 0) {
              debtForm.setValue('amountRepaid', totalAmount);
          }
      }
  }, [debtStatus, debtForm]);


  // Client Submit Handler
  function onClientSubmit(values: Client) {
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
      clientForm.reset(); // Reset form fields after submission
  }

  // Debt Submit Handler
   function onDebtSubmit(values: Debt) {
       let finalValues = { ...values };

       if (finalValues.status === 'outstanding') {
           finalValues.amountRepaid = 0;
           finalValues.paidDate = undefined;
       } else if (finalValues.status === 'paid') {
           finalValues.amountRepaid = finalValues.amount;
       }

       const newDebt = { ...finalValues, id: crypto.randomUUID() };

       setDebts((prevDebts) => [...prevDebts, newDebt]);
       toast({
           title: 'تمت إضافة الدين',
           description: `تمت إضافة الدين على ${values.debtorName} بنجاح.`,
       });
       debtForm.reset(); // Reset form fields
   }


  const deleteClient = (idToDelete: string) => {
    setClients((prevClients) => prevClients.filter(client => client.id !== idToDelete));
    toast({
      title: 'تم حذف العميل',
      description: `تمت إزالة سجل العميل.`,
      variant: 'destructive',
    });
  };

   const deleteDebt = (idToDelete: string) => {
       setDebts((prevDebts) => prevDebts.filter(debt => debt.id !== idToDelete));
       toast({
           title: 'تم حذف الدين',
           description: `تمت إزالة سجل الدين.`,
           variant: 'destructive',
       });
   };

  const updateClientStatus = (clientId: string, newStatus: PaymentStatus) => {
    setClients(prevClients =>
      prevClients.map(client => {
        if (client.id === clientId) {
          let updatedClient = { ...client, paymentStatus: newStatus };

          // Adjust fields based on new status
          if (newStatus === 'not_paid') {
            updatedClient.amountPaidSoFar = 0;
            updatedClient.paymentDate = undefined;
          } else if (newStatus === 'paid') {
            updatedClient.amountPaidSoFar = client.totalProjectCost;
            // If payment date wasn't set before, set it to today (or prompt user)
            if (!updatedClient.paymentDate) {
                updatedClient.paymentDate = new Date();
                toast({
                    title: 'تنبيه',
                    description: `تم تحديث حالة الدفع لـ "${client.name}" إلى "تم الدفع". تم تعيين تاريخ الدفع إلى اليوم. يمكنك تعديله لاحقًا إذا لزم الأمر.`,
                    variant: 'default',
                });
            }
          } else { // partially_paid
             // If switching to partially paid, ensure amountPaidSoFar and paymentDate exist.
             if (updatedClient.amountPaidSoFar === undefined || updatedClient.amountPaidSoFar === null || (client.paymentStatus === 'not_paid' && updatedClient.amountPaidSoFar === 0)) {
                  updatedClient.amountPaidSoFar = undefined;
                  toast({
                     title: 'تنبيه',
                     description: `تم تحديث حالة الدفع لـ "${client.name}" إلى "دفع جزئي". يرجى تحديث المبلغ المدفوع وتاريخ الدفعة.`,
                     variant: 'default',
                  });
             }
             if (!updatedClient.paymentDate) {
                 updatedClient.paymentDate = new Date();
                  toast({
                      title: 'تنبيه',
                      description: `تم تعيين تاريخ الدفع لـ "${client.name}" إلى اليوم تلقائيًا لحالة "دفع جزئي". يمكنك تعديله.`,
                      variant: 'default',
                  });
             }
          }

          // Validate the updated client data (optional but good practice)
          try {
            clientSchema.parse(updatedClient);
            toast({
                title: 'تم تحديث الحالة',
                description: `تم تغيير حالة دفع "${client.name}" إلى "${PAYMENT_STATUSES[newStatus]}".`,
            });
            return updatedClient;
          } catch (error: any) {
            console.error("Validation failed after status update:", error);
             toast({
                 title: 'خطأ في التحديث',
                 description: `فشل تحديث حالة الدفع لـ "${client.name}". ${error.errors?.[0]?.message || 'بيانات غير صالحة.'}`,
                 variant: 'destructive',
             });
            return client; // Revert if validation fails
          }
        }
        return client;
      })
    );
  };

  const updateDebtStatus = (debtId: string, newStatus: DebtStatus) => {
      setDebts(prevDebts =>
          prevDebts.map(debt => {
              if (debt.id === debtId) {
                  let updatedDebt = { ...debt, status: newStatus };

                  if (newStatus === 'outstanding') {
                      updatedDebt.amountRepaid = 0;
                      updatedDebt.paidDate = undefined;
                  } else if (newStatus === 'paid') {
                      updatedDebt.amountRepaid = debt.amount;
                      if (!updatedDebt.paidDate) {
                          updatedDebt.paidDate = new Date();
                          toast({
                              title: 'تنبيه',
                              description: `تم تحديث حالة الدين على "${debt.debtorName}" إلى "تم السداد". تم تعيين تاريخ السداد إلى اليوم.`,
                              variant: 'default',
                          });
                      }
                  } else { // partially_paid
                      if (updatedDebt.amountRepaid === undefined || updatedDebt.amountRepaid === null || (debt.status === 'outstanding' && updatedDebt.amountRepaid === 0)) {
                          updatedDebt.amountRepaid = undefined;
                           toast({
                              title: 'تنبيه',
                              description: `تم تحديث حالة الدين على "${debt.debtorName}" إلى "سداد جزئي". يرجى تحديث المبلغ المسدد وتاريخ السداد.`,
                              variant: 'default',
                          });
                      }
                      if (!updatedDebt.paidDate) {
                          updatedDebt.paidDate = new Date();
                           toast({
                              title: 'تنبيه',
                              description: `تم تعيين تاريخ السداد للدين على "${debt.debtorName}" إلى اليوم تلقائيًا لحالة "سداد جزئي". يمكنك تعديله.`,
                              variant: 'default',
                          });
                      }
                  }

                  try {
                      debtSchema.parse(updatedDebt);
                      toast({
                          title: 'تم تحديث الحالة',
                          description: `تم تغيير حالة الدين على "${debt.debtorName}" إلى "${DEBT_STATUSES[newStatus]}".`,
                      });
                      return updatedDebt;
                  } catch (error: any) {
                       console.error("Validation failed after debt status update:", error);
                       toast({
                           title: 'خطأ في التحديث',
                           description: `فشل تحديث حالة الدين. ${error.errors?.[0]?.message || 'بيانات غير صالحة.'}`,
                           variant: 'destructive',
                       });
                      return debt; // Revert
                  }
              }
              return debt;
          })
      );
  };

   // Convert any currency to USD
   const convertToUSD = useCallback((amount: number, fromCurrency: Currency): number | null => {
       if (rateLoading || !exchangeRates) return null;
       const rateToUSD = exchangeRates[fromCurrency];
       if (!rateToUSD) {
           console.warn(`Exchange rate not available for ${fromCurrency}`);
           return null; // Rate not available
       }
       if (fromCurrency === 'USD') return amount;
       // The API gives rates relative to USD. So data.rates.EGP is EGP per 1 USD.
       // To convert EGP to USD: amount EGP / (EGP per 1 USD) = amount USD
       return amount / rateToUSD;
   }, [exchangeRates, rateLoading]); // Dependencies


  const requestClientSort = (key: keyof Client | 'remainingAmount') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (clientSortConfig.key === key && clientSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setClientSortConfig({ key, direction });
  };

   const requestDebtSort = (key: keyof Debt | 'remainingDebt') => {
       let direction: 'ascending' | 'descending' = 'ascending';
       if (debtSortConfig.key === key && debtSortConfig.direction === 'ascending') {
           direction = 'descending';
       }
       setDebtSortConfig({ key, direction });
   };

  const calculateClientRemainingAmount = (client: Partial<Client>): number => {
      if (!client.totalProjectCost || client.totalProjectCost <= 0) return 0;
      if (client.paymentStatus === 'paid') return 0;
      const paid = client.amountPaidSoFar ?? 0;
      return Math.max(0, client.totalProjectCost - paid);
  };

  const calculateDebtRemainingAmount = (debt: Partial<Debt>): number => {
      if (!debt.amount || debt.amount <= 0) return 0;
      if (debt.status === 'paid') return 0;
      const repaid = debt.amountRepaid ?? 0;
      return Math.max(0, debt.amount - repaid);
  };


  const sortedClients = useMemo(() => {
    if (!isMounted) return []; // Return empty array during SSR or before mount

    return [...clients].sort((a, b) => {
        if (!clientSortConfig.key) return 0;

        let aValue, bValue;

        if (clientSortConfig.key === 'remainingAmount') {
            aValue = calculateClientRemainingAmount(a);
            bValue = calculateClientRemainingAmount(b);
        } else {
            aValue = a[clientSortConfig.key as keyof Client];
            bValue = b[clientSortConfig.key as keyof Client];
        }

        // Handle undefined/null values consistently
        const aHasValue = aValue !== undefined && aValue !== null;
        const bHasValue = bValue !== undefined && bValue !== null;

        if (!aHasValue && !bHasValue) return 0;
        if (!aHasValue) return clientSortConfig.direction === 'ascending' ? 1 : -1; // Sort undefined/null to the end
        if (!bHasValue) return clientSortConfig.direction === 'ascending' ? -1 : 1; // Sort undefined/null to the end


        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
        } else {
            // Use localeCompare for string sorting (en for consistency, Arabic was 'ar')
            comparison = String(aValue).localeCompare(String(bValue), 'en');
        }
        return clientSortConfig.direction === 'ascending' ? comparison : -comparison;
    });
  }, [clients, clientSortConfig, isMounted]);

  const sortedDebts = useMemo(() => {
     if (!isMounted) return [];

     return [...debts].sort((a, b) => {
         if (!debtSortConfig.key) return 0;

         let aValue, bValue;

         if (debtSortConfig.key === 'remainingDebt') {
             aValue = calculateDebtRemainingAmount(a);
             bValue = calculateDebtRemainingAmount(b);
         } else {
             aValue = a[debtSortConfig.key as keyof Debt];
             bValue = b[debtSortConfig.key as keyof Debt];
         }

         const aHasValue = aValue !== undefined && aValue !== null;
         const bHasValue = bValue !== undefined && bValue !== null;

         if (!aHasValue && !bHasValue) return 0;
         if (!aHasValue) return debtSortConfig.direction === 'ascending' ? 1 : -1;
         if (!bHasValue) return debtSortConfig.direction === 'ascending' ? -1 : 1;

         let comparison = 0;
         if (typeof aValue === 'number' && typeof bValue === 'number') {
             comparison = aValue - bValue;
         } else if (aValue instanceof Date && bValue instanceof Date) {
             comparison = aValue.getTime() - bValue.getTime();
         } else {
             comparison = String(aValue).localeCompare(String(bValue), 'en'); // Sort strings in English locale
         }
         return debtSortConfig.direction === 'ascending' ? comparison : -comparison;
     });
  }, [debts, debtSortConfig, isMounted]);


  const SortableClientHeader = ({ columnKey, title }: { columnKey: keyof Client | 'remainingAmount', title: string }) => (
    <TableHead onClick={() => requestClientSort(columnKey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {title}
        {clientSortConfig.key === columnKey && (
          <ArrowUpDown className={`h-4 w-4 text-foreground transform ${clientSortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
        )}
        {clientSortConfig.key !== columnKey && (
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

  const SortableDebtHeader = ({ columnKey, title }: { columnKey: keyof Debt | 'remainingDebt', title: string }) => (
       <TableHead onClick={() => requestDebtSort(columnKey)} className="cursor-pointer hover:bg-muted/50">
         <div className="flex items-center gap-2">
           {title}
           {debtSortConfig.key === columnKey && (
             <ArrowUpDown className={`h-4 w-4 text-foreground transform ${debtSortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />
           )}
           {debtSortConfig.key !== columnKey && (
               <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
           )}
         </div>
       </TableHead>
     );


   // Format currency using en-US locale for English numbers and standard symbols
   const formatCurrency = (amount: number | null | undefined, currency: Currency) => {
    if (amount === null || amount === undefined) return '-';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        // Use 'en-US' locale to ensure English numerals and standard currency symbols/placement
        // This overrides the browser's default locale for number formatting.
    };
    const locale = 'en-US';

    try {
        // Handle potential negative zero for display
        const displayAmount = Object.is(amount, -0) ? 0 : amount;
        return displayAmount.toLocaleString(locale, options);
    } catch (e) {
        // Fallback for environments with limited locale support or errors
        console.warn(`Locale formatting failed for ${currency} with locale ${locale}:`, e);
        // Basic fallback with English numerals
        const symbols: { [key in Currency]: string } = { EGP: 'EGP', SAR: 'SAR', USD: '$', CAD: 'CA$', EUR: '€' };
        return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    }
   };

   // Format dates using Arabic locale (arSA)
   const formatDateAr = (date: Date | null | undefined) => {
        if (!date || isNaN(date.getTime())) return '-';
        return format(date, 'PPP', { locale: arSA });
   }


  const totalPaidUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return sortedClients.reduce((sum, client) => {
          const paidAmount = client.amountPaidSoFar ?? 0;
          const amountInUSD = convertToUSD(paidAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
  }, [sortedClients, isMounted, exchangeRates, rateLoading, convertToUSD]); // Added convertToUSD

    const totalRemainingUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return sortedClients.reduce((sum, client) => {
          const remainingAmount = calculateClientRemainingAmount(client);
          const amountInUSD = convertToUSD(remainingAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
    }, [sortedClients, isMounted, exchangeRates, rateLoading, convertToUSD]); // Added convertToUSD

    // Calculate total outstanding debt in USD
    const totalOutstandingDebtUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return sortedDebts.reduce((sum, debt) => {
        if (debt.status === 'paid') return sum;
        const remainingDebt = calculateDebtRemainingAmount(debt);
        const amountInUSD = convertToUSD(remainingDebt, debt.currency);
        return sum + (amountInUSD ?? 0);
      }, 0);
    }, [sortedDebts, isMounted, exchangeRates, rateLoading, convertToUSD]);


 // Process data for the chart (sum of payments per day in USD for the current month)
 const chartData: ChartData[] | null = useMemo(() => {
   if (!isMounted || rateLoading || !exchangeRates) return null; // Return null if rates not ready

   const now = new Date();
   const startOfMonth = dateFnsStartOfMonth(now);
   const endOfMonth = dateFnsEndOfMonth(now);

   // Filter clients with payments within the current month
   const paymentsInMonth = sortedClients
     .filter(
       (client) =>
         (client.paymentStatus === 'paid' || client.paymentStatus === 'partially_paid') &&
         client.paymentDate &&
         !isNaN(client.paymentDate.getTime()) &&
         client.paymentDate >= startOfMonth &&
         client.paymentDate <= endOfMonth &&
         client.amountPaidSoFar !== undefined && client.amountPaidSoFar !== null // Ensure there's an amount paid
     )
     .map(client => ({
       id: client.id, // Include client ID for potential differentiation
       date: client.paymentDate!,
       amountUSD: convertToUSD(client.amountPaidSoFar ?? 0, client.currency) ?? 0,
       // We need the *previous* known amount paid for this client to calculate the increment
       // This requires more complex state or data structure.
       // For now, we'll assume `amountPaidSoFar` represents the total paid *on that date*.
       // This simplification means the chart might not accurately represent daily *income*
       // if `amountPaidSoFar` is updated multiple times without changing the date,
       // or if it always stores the cumulative total rather than the payment amount itself.
     }))
     .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort payments by date

   // Group payments by day and sum the amounts in USD
   const dailyTotals: { [key: string]: { date: Date; total: number } } = {};
   let currentDate = startOfMonth;

   // Pre-fill all days of the month with zero total
   while (currentDate <= endOfMonth) {
     const dateStr = format(currentDate, 'yyyy-MM-dd');
     dailyTotals[dateStr] = { date: new Date(currentDate), total: 0 };
     currentDate = addDays(currentDate, 1);
   }

   // Aggregate payments per day
   // WARNING: This assumes `amountUSD` is the payment amount for that day.
   // If `amountPaidSoFar` is cumulative, this logic is incorrect for daily income.
   // A better data structure would store individual payment transactions.
   paymentsInMonth.forEach(payment => {
     const dateStr = format(payment.date, 'yyyy-MM-dd');
     if (dailyTotals[dateStr]) {
        // If the data represents cumulative, we need the previous day's value for this client
        // to find the increment. This is complex with the current structure.
        // Assuming `payment.amountUSD` IS the payment amount for that day:
        dailyTotals[dateStr].total += payment.amountUSD;
     }
   });

   // Convert to chart data format
   return Object.values(dailyTotals)
     .map(data => ({
       date: format(data.date, 'd MMM', { locale: arSA }), // Arabic date format
       total: data.total, // Sum of payments in USD for that day
     }))
     // Filter out days with zero income if desired, or keep them to show the full month
     .filter(d => d.total > 0); // Optional: only show days with income

 }, [sortedClients, isMounted, exchangeRates, rateLoading, convertToUSD]);


  if (!isMounted) {
    // Render a loading state or null during SSR/pre-mount
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-foreground">جاري تحميل البيانات...</p>
        </div>
    );
  }

  // Calculate remaining amounts for forms
  const clientRemainingAmountInForm = calculateClientRemainingAmount({
    totalProjectCost: clientTotalProjectCost,
    amountPaidSoFar: clientAmountPaidSoFar,
    paymentStatus: clientPaymentStatus
  });

  const debtRemainingAmountInForm = calculateDebtRemainingAmount({
      amount: debtAmount,
      amountRepaid: debtAmountRepaid,
      status: debtStatus,
  });


  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-primary">لوحة التحكم المالية</h1>

        {/* Exchange Rate Info/Error */}
         {rateLoading && (
            <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300 shadow">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <AlertTitle>جاري جلب أسعار الصرف...</AlertTitle>
              <AlertDescription>لحظات قليلة ويتم عرض أسعار الصرف الحالية.</AlertDescription>
            </Alert>
          )}
          {rateError && !rateLoading && (
            <Alert variant="destructive" className="mb-6 shadow">
              <AlertCircle className="h-4 w-4 mr-2"/>
              <AlertTitle>خطأ في سعر الصرف</AlertTitle>
              <AlertDescription>{rateError} لا يمكن حساب القيم بالدولار الأمريكي حالياً.</AlertDescription>
            </Alert>
          )}
          {exchangeRates && !rateLoading && <ExchangeRateSlider rates={exchangeRates} />}


      {/* Client Form Card */}
      <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-xl text-foreground">إضافة عميل جديد</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={clientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">اسم العميل</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل اسم العميل" {...field} className="bg-background"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">وصف المشروع</FormLabel>
                      <FormControl>
                        <Input placeholder="أدخل تفاصيل المشروع" {...field} className="bg-background"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={clientForm.control}
                  name="totalProjectCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">التكلفة الإجمالية للمشروع</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="أدخل التكلفة الإجمالية" {...field} step="0.01" className="bg-background"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={clientForm.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-foreground">العملة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger className="bg-background">
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
                    control={clientForm.control}
                    name="paymentStatus"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-foreground">حالة الدفع</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger className="bg-background">
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
                 {(clientPaymentStatus === 'paid' || clientPaymentStatus === 'partially_paid') && (
                    <>
                       <FormField
                            control={clientForm.control}
                            name="amountPaidSoFar"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-foreground">
                                    المبلغ المدفوع حتى الآن
                                    {clientPaymentStatus === 'paid' && <span className='text-muted-foreground text-xs ml-1'> (يجب أن يساوي التكلفة الإجمالية)</span>}
                                    </FormLabel>
                                <FormControl>
                                    <Input
                                    type="number"
                                    placeholder="أدخل المبلغ المدفوع"
                                    {...field}
                                    step="0.01"
                                    className="bg-background"
                                    value={field.value ?? ''} // Ensure value is controlled, handle undefined
                                    onChange={(e) => {
                                        // Allow clearing the field, parse otherwise
                                        const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                        field.onChange(value);
                                    }}
                                    />
                                </FormControl>
                                 {/* Show remaining amount hint for partially paid */}
                                 {clientPaymentStatus === 'partially_paid' && clientAmountPaidSoFar !== undefined && clientAmountPaidSoFar !== null && clientTotalProjectCost > 0 && (
                                     <FormDescription className="text-sm text-green-600 dark:text-green-400 pt-1 font-medium">
                                         المبلغ المتبقي: {formatCurrency(clientRemainingAmountInForm, clientSelectedCurrency)}
                                     </FormDescription>
                                 )}
                                <FormMessage />
                                </FormItem>
                            )}
                       />
                        <FormField
                            control={clientForm.control}
                            name="paymentDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel className="mb-2 text-foreground">تاريخ الدفعة</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={'outline'}
                                        className={cn(
                                            'w-full pr-3 text-right font-normal justify-between bg-background', // Adjusted text alignment for RTL & space between
                                            !field.value && 'text-muted-foreground'
                                        )}
                                        >
                                        {field.value && !isNaN(field.value.getTime()) ? ( // Check if date is valid
                                            format(field.value, 'PPP', { locale: arSA }) // Use Arabic locale for display
                                        ) : (
                                            <span>اختر تاريخًا</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> {/* Adjusted margin for RTL */}
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(date) => field.onChange(date)} // Pass selected date directly
                                        disabled={(date) =>
                                        date > new Date() || date < new Date('1900-01-01')
                                        }
                                        initialFocus
                                        locale={arSA} // Set locale for Calendar display
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
              <Button type="submit" className="mt-6 w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90 transition duration-150 ease-in-out">إضافة عميل</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Debt Form Card */}
      <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
          <CardHeader className="bg-muted/50">
              <CardTitle className="text-xl text-foreground">إضافة دين جديد</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
              <Form {...debtForm}>
                  <form onSubmit={debtForm.handleSubmit(onDebtSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                              control={debtForm.control}
                              name="description"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-foreground">وصف الدين</FormLabel>
                                      <FormControl>
                                          <Input placeholder="أدخل وصفًا للدين" {...field} className="bg-background"/>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={debtForm.control}
                              name="debtorName"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-foreground">اسم المدين</FormLabel>
                                      <FormControl>
                                          <Input placeholder="اسم الشخص أو الجهة المدينة" {...field} className="bg-background"/>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={debtForm.control}
                              name="creditorName"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-foreground">اسم الدائن</FormLabel>
                                      <FormControl>
                                          <Input placeholder="اسم الشخص أو الجهة الدائنة" {...field} className="bg-background"/>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={debtForm.control}
                              name="amount"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-foreground">المبلغ الإجمالي للدين</FormLabel>
                                      <FormControl>
                                          <Input type="number" placeholder="أدخل المبلغ" {...field} step="0.01" className="bg-background"/>
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                           <FormField
                              control={debtForm.control}
                              name="currency"
                              render={({ field }) => (
                                  <FormItem>
                                  <FormLabel className="text-foreground">العملة</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                      <SelectTrigger className="bg-background">
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
                              control={debtForm.control}
                              name="dueDate"
                              render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                  <FormLabel className="mb-2 text-foreground">تاريخ الاستحقاق</FormLabel>
                                  <Popover>
                                      <PopoverTrigger asChild>
                                      <FormControl>
                                          <Button
                                          variant={'outline'}
                                          className={cn(
                                              'w-full pr-3 text-right font-normal justify-between bg-background',
                                              !field.value && 'text-muted-foreground'
                                          )}
                                          >
                                          {field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر تاريخًا</span>}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                          </Button>
                                      </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          initialFocus
                                          locale={arSA}
                                      />
                                      </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                  </FormItem>
                              )}
                          />
                           <FormField
                              control={debtForm.control}
                              name="status"
                              render={({ field }) => (
                                  <FormItem>
                                  <FormLabel className="text-foreground">حالة الدين</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                      <SelectTrigger className="bg-background">
                                          <SelectValue placeholder="اختر حالة الدين" />
                                      </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                      {Object.entries(DEBT_STATUSES).map(([key, value]) => (
                                          <SelectItem key={key} value={key}>{value}</SelectItem>
                                      ))}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                                  </FormItem>
                              )}
                          />

                         {/* Conditional Fields for Debt */}
                         {(debtStatus === 'paid' || debtStatus === 'partially_paid') && (
                              <>
                                 <FormField
                                      control={debtForm.control}
                                      name="amountRepaid"
                                      render={({ field }) => (
                                          <FormItem>
                                          <FormLabel className="text-foreground">
                                              المبلغ المسدد حتى الآن
                                              {debtStatus === 'paid' && <span className='text-muted-foreground text-xs ml-1'> (يجب أن يساوي المبلغ الإجمالي)</span>}
                                          </FormLabel>
                                          <FormControl>
                                              <Input
                                              type="number"
                                              placeholder="أدخل المبلغ المسدد"
                                              {...field}
                                              step="0.01"
                                              className="bg-background"
                                              value={field.value ?? ''}
                                              onChange={(e) => {
                                                  const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                  field.onChange(value);
                                              }}
                                              />
                                          </FormControl>
                                           {debtStatus === 'partially_paid' && debtAmountRepaid !== undefined && debtAmountRepaid !== null && debtAmount > 0 && (
                                               <FormDescription className="text-sm text-yellow-600 dark:text-yellow-400 pt-1 font-medium">
                                                   المبلغ المتبقي من الدين: {formatCurrency(debtRemainingAmountInForm, debtSelectedCurrency)}
                                               </FormDescription>
                                           )}
                                          <FormMessage />
                                          </FormItem>
                                      )}
                                 />
                                  <FormField
                                      control={debtForm.control}
                                      name="paidDate"
                                      render={({ field }) => (
                                          <FormItem className="flex flex-col">
                                          <FormLabel className="mb-2 text-foreground">تاريخ السداد</FormLabel>
                                          <Popover>
                                              <PopoverTrigger asChild>
                                              <FormControl>
                                                  <Button
                                                  variant={'outline'}
                                                  className={cn(
                                                      'w-full pr-3 text-right font-normal justify-between bg-background',
                                                      !field.value && 'text-muted-foreground'
                                                  )}
                                                  >
                                                  {field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر تاريخًا</span>}
                                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                  </Button>
                                              </FormControl>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0" align="start">
                                              <Calendar
                                                  mode="single"
                                                  selected={field.value}
                                                  onSelect={field.onChange}
                                                  disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                                                  initialFocus
                                                  locale={arSA}
                                              />
                                              </PopoverContent>
                                          </Popover>
                                          <FormMessage />
                                          </FormItem>
                                      )}
                                  />
                               </>
                           )}
                           {/* Notes field (full width) */}
                            <FormField
                                control={debtForm.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2"> {/* Span across 2 columns on medium screens */}
                                        <FormLabel className="text-foreground">ملاحظات</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="أضف أي ملاحظات إضافية هنا..." {...field} className="bg-background"/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                      </div>
                      <Button type="submit" className="mt-6 w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90 transition duration-150 ease-in-out">إضافة دين</Button>
                  </form>
              </Form>
          </CardContent>
      </Card>


       {/* Payment Chart Card (Daily Income USD for current month) */}
       {chartData && chartData.length > 0 && (
         <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
           <CardHeader className="bg-muted/50">
             <CardTitle className="text-xl text-foreground">الدخل اليومي الشهري (بالدولار الأمريكي - تقديري)</CardTitle>
             <AlertDescription className="text-muted-foreground mt-2">
                ملاحظة: يمثل الرسم البياني الدخل اليومي المقدر بالدولار الأمريكي لهذا الشهر، بناءً على تواريخ الدفع المسجلة ومقدار الدفعة (المبلغ المدفوع حتى الآن).
                <br/>
                الدقة تعتمد على تسجيل <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">المبلغ المدفوع حتى الآن</code> بشكل صحيح ليعكس المبلغ الفعلي المدفوع في ذلك التاريخ. إذا كان الحقل يعكس دائمًا الإجمالي التراكمي، فلن يعكس الرسم البياني الدخل اليومي بدقة. للحصول على دقة مطلقة، يجب تتبع كل دفعة فردية بسجل منفصل (ميزة غير متوفرة حاليًا).
             </AlertDescription>
           </CardHeader>
           <CardContent className="p-4 md:p-6"> {/* Adjusted padding for chart */}
             <ClientPaymentChart data={chartData} />
           </CardContent>
         </Card>
       )}
       {chartData === null && !rateLoading && rateError && (
          <Alert variant="destructive" className="mb-8 shadow">
              <AlertCircle className="h-4 w-4 mr-2"/>
            <AlertTitle>لا يمكن عرض الرسم البياني</AlertTitle>
            <AlertDescription>تعذر تحميل الرسم البياني للدخل بسبب خطأ في جلب سعر الصرف.</AlertDescription>
          </Alert>
       )}
       {chartData?.length === 0 && !rateLoading && !rateError && (
           <Alert className="mb-8 shadow border border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300">
               <AlertCircle className="h-4 w-4 mr-2" />
               <AlertTitle>لا توجد بيانات لعرضها</AlertTitle>
               <AlertDescription>لا توجد دفعات مسجلة لهذا الشهر لعرضها في الرسم البياني.</AlertDescription> {/* Updated message */}
           </Alert>
       )}


      {/* Client Records Card */}
      <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-xl text-foreground">سجلات العملاء</CardTitle>
        </CardHeader>
        <CardContent className="pt-0"> {/* Remove top padding as header provides it */}
          <Table>
            <TableCaption className="mt-4 mb-2 text-muted-foreground">قائمة بعملائك ومشاريعهم وحالات الدفع.</TableCaption>
            <TableHeader>
              <TableRow className="border-b border-border">
                <SortableClientHeader columnKey="name" title="اسم العميل" />
                <SortableClientHeader columnKey="project" title="المشروع" />
                <SortableClientHeader columnKey="totalProjectCost" title="التكلفة الإجمالية" />
                 <TableHead>العملة</TableHead>
                <SortableClientHeader columnKey="paymentStatus" title="حالة الدفع" />
                <SortableClientHeader columnKey="amountPaidSoFar" title="المدفوع" />
                <SortableClientHeader columnKey="remainingAmount" title="المتبقي" />
                <TableHead>المتبقي (دولار)</TableHead>
                <SortableClientHeader columnKey="paymentDate" title="تاريخ الدفع" />
                <TableHead className="text-left">الإجراءات</TableHead>{/* Adjusted alignment for RTL */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length > 0 ? (
                sortedClients.map((client) => {
                    const remainingAmount = calculateClientRemainingAmount(client);
                    const remainingAmountUSD = convertToUSD(remainingAmount, client.currency);
                    const amountPaid = client.amountPaidSoFar ?? 0;
                    return (
                      <TableRow key={client.id} className="hover:bg-muted/30 transition-colors duration-150">
                        <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.project}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(client.totalProjectCost, client.currency)}</TableCell>
                        <TableCell className="text-muted-foreground">{CURRENCIES[client.currency]}</TableCell>
                        <TableCell>
                             <Select
                                defaultValue={client.paymentStatus}
                                onValueChange={(newStatus) => client.id && updateClientStatus(client.id, newStatus as PaymentStatus)}
                             >
                                <SelectTrigger className={cn(
                                    "w-[130px] text-xs border rounded-md py-1 px-2 focus:ring-1 focus:ring-ring focus:ring-offset-0", // Basic styling, adjust as needed
                                     client.paymentStatus === 'paid' && 'text-green-800 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
                                     client.paymentStatus === 'partially_paid' && 'text-yellow-800 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
                                     client.paymentStatus === 'not_paid' && 'text-red-800 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                                 )}>
                                <SelectValue placeholder="تغيير الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                {Object.entries(PAYMENT_STATUSES).map(([key, value]) => (
                                    <SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                         <TableCell className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(amountPaid, client.currency)}</TableCell>
                         <TableCell className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(remainingAmount, client.currency)}</TableCell>
                         <TableCell className="font-semibold text-blue-700 dark:text-blue-400">
                            {rateLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                             remainingAmountUSD !== null ? formatCurrency(remainingAmountUSD, 'USD') :
                             rateError ? <span className="text-destructive text-xs" title={rateError}>خطأ</span> : '-'}
                         </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateAr(client.paymentDate)}</TableCell> {/* Use Arabic date format */}
                        <TableCell className="text-left"> {/* Adjusted alignment for RTL */}
                          <Button variant="ghost" size="icon" onClick={() => client.id && deleteClient(client.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    لم تتم إضافة عملاء بعد. ابدأ بإضافة عميل جديد باستخدام النموذج أعلاه.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             <TableFooter className="bg-muted/30">
                <TableRow>
                  <TableCell colSpan={7} className="font-semibold text-right text-foreground">الإجمالي المتبقي (بالدولار الأمريكي)</TableCell>
                  <TableCell className="font-bold text-red-700 dark:text-red-400">
                    {rateLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                     totalRemainingUSD !== null ? formatCurrency(totalRemainingUSD, 'USD') :
                     rateError ? <span className="text-destructive text-xs" title={rateError}>خطأ</span> : '-'}
                  </TableCell>
                   <TableCell colSpan={2}></TableCell>
                </TableRow>
                 <TableRow>
                  <TableCell colSpan={7} className="font-semibold text-right text-foreground">إجمالي المدفوع (بالدولار الأمريكي)</TableCell>
                  <TableCell className="font-bold text-green-700 dark:text-green-400">
                    {rateLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                     totalPaidUSD !== null ? formatCurrency(totalPaidUSD, 'USD') :
                     rateError ? <span className="text-destructive text-xs" title={rateError}>خطأ</span> : '-'}
                  </TableCell>
                   <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Debt Records Card */}
      <Card className="shadow-lg border border-border rounded-lg overflow-hidden">
          <CardHeader className="bg-muted/50">
              <CardTitle className="text-xl text-foreground">سجلات الديون</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
              <Table>
                  <TableCaption className="mt-4 mb-2 text-muted-foreground">قائمة بالديون المستحقة والمدفوعة.</TableCaption>
                  <TableHeader>
                      <TableRow className="border-b border-border">
                          <SortableDebtHeader columnKey="description" title="وصف الدين" />
                          <SortableDebtHeader columnKey="debtorName" title="المدين" />
                          <SortableDebtHeader columnKey="creditorName" title="الدائن" />
                          <SortableDebtHeader columnKey="amount" title="المبلغ الإجمالي" />
                          <TableHead>العملة</TableHead>
                          <SortableDebtHeader columnKey="status" title="حالة السداد" />
                          <SortableDebtHeader columnKey="amountRepaid" title="المسدد" />
                          <SortableDebtHeader columnKey="remainingDebt" title="المتبقي" />
                          <TableHead>المتبقي (دولار)</TableHead>
                          <SortableDebtHeader columnKey="dueDate" title="تاريخ الاستحقاق" />
                          <SortableDebtHeader columnKey="paidDate" title="تاريخ السداد" />
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
                              return (
                                  <TableRow key={debt.id} className="hover:bg-muted/30 transition-colors duration-150">
                                      <TableCell className="font-medium text-foreground">{debt.description}</TableCell>
                                      <TableCell className="text-muted-foreground">{debt.debtorName}</TableCell>
                                      <TableCell className="text-muted-foreground">{debt.creditorName}</TableCell>
                                      <TableCell className="font-semibold">{formatCurrency(debt.amount, debt.currency)}</TableCell>
                                      <TableCell className="text-muted-foreground">{CURRENCIES[debt.currency]}</TableCell>
                                      <TableCell>
                                          <Select
                                              defaultValue={debt.status}
                                              onValueChange={(newStatus) => debt.id && updateDebtStatus(debt.id, newStatus as DebtStatus)}
                                          >
                                              <SelectTrigger className={cn(
                                                  "w-[130px] text-xs border rounded-md py-1 px-2 focus:ring-1 focus:ring-ring focus:ring-offset-0",
                                                   debt.status === 'paid' && 'text-green-800 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
                                                   debt.status === 'partially_paid' && 'text-yellow-800 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
                                                   debt.status === 'outstanding' && 'text-red-800 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                                              )}>
                                                  <SelectValue placeholder="تغيير الحالة" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                  {Object.entries(DEBT_STATUSES).map(([key, value]) => (
                                                      <SelectItem key={key} value={key} className="text-xs">{value}</SelectItem>
                                                  ))}
                                              </SelectContent>
                                          </Select>
                                      </TableCell>
                                      <TableCell className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(amountRepaid, debt.currency)}</TableCell>
                                      <TableCell className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(remainingDebt, debt.currency)}</TableCell>
                                      <TableCell className="font-semibold text-blue-700 dark:text-blue-400">
                                         {rateLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                                          remainingDebtUSD !== null ? formatCurrency(remainingDebtUSD, 'USD') :
                                          rateError ? <span className="text-destructive text-xs" title={rateError}>خطأ</span> : '-'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">{formatDateAr(debt.dueDate)}</TableCell> {/* Arabic date format */}
                                      <TableCell className="text-muted-foreground">{formatDateAr(debt.paidDate)}</TableCell> {/* Arabic date format */}
                                      <TableCell className="text-muted-foreground max-w-[150px] truncate" title={debt.notes || ''}>{debt.notes || '-'}</TableCell>
                                      <TableCell className="text-left">
                                          <Button variant="ghost" size="icon" onClick={() => debt.id && deleteDebt(debt.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                                              <Trash2 className="h-4 w-4" />
                                              <span className="sr-only">حذف</span>
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              );
                          })
                      ) : (
                          <TableRow>
                              <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                                  لم تتم إضافة ديون بعد. استخدم النموذج أعلاه لتسجيل دين جديد.
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
                  <TableFooter className="bg-muted/30">
                     <TableRow>
                       <TableCell colSpan={8} className="font-semibold text-right text-foreground">إجمالي الديون المستحقة (بالدولار الأمريكي)</TableCell>
                       <TableCell className="font-bold text-red-700 dark:text-red-400">
                         {rateLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
                          totalOutstandingDebtUSD !== null ? formatCurrency(totalOutstandingDebtUSD, 'USD') :
                          rateError ? <span className="text-destructive text-xs" title={rateError}>خطأ</span> : '-'}
                       </TableCell>
                        <TableCell colSpan={4}></TableCell>
                     </TableRow>
                   </TableFooter>
              </Table>
          </CardContent>
      </Card>

    </div>
  );
};

export default ClientTracker;
