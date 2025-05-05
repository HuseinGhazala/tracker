
'use client';

import * as React from 'react'; // Ensure React is imported
import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useCallback and useRef
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format, startOfMonth as dateFnsStartOfMonth, endOfMonth as dateFnsEndOfMonth, addDays } from 'date-fns'; // Import date-fns functions
import { arSA } from 'date-fns/locale'; // Import Arabic locale for date display only
import { CalendarIcon, ArrowUpDown, Trash2, Loader2, AlertCircle, Edit } from 'lucide-react'; // Added Edit icon
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

// ----- SCHEMA DEFINITIONS -----

// Payment Schema (represents a single payment event)
const paymentSchema = z.object({
  id: z.string(), // Unique ID for the payment
  clientId: z.string(), // ID of the client this payment belongs to
  amount: z.coerce.number().positive({ message: 'مبلغ الدفعة يجب أن يكون رقمًا موجبًا.' }),
  paymentDate: z.date({ required_error: 'تاريخ الدفعة مطلوب.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'عملة الدفعة مطلوبة.' }),
});
type Payment = z.infer<typeof paymentSchema>;


// Define the schema for client data with Arabic error messages
const clientSchema = z.object({
  id: z.string().optional(), // Optional for new clients, required for existing
  name: z.string().min(1, { message: 'اسم العميل مطلوب.' }),
  project: z.string().min(1, { message: 'وصف المشروع مطلوب.' }),
  totalProjectCost: z.coerce.number().positive({ message: 'يجب أن تكون التكلفة الإجمالية رقمًا موجبًا.' }),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]], { required_error: 'العملة مطلوبة.' }),
  // paymentStatus, amountPaidSoFar, paymentDate are derived/managed separately now
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
  // Require paidDate if status is partially_paid and amountRepaid is positive
  // Or if status is paid
  if ( (data.status === 'partially_paid' && (data.amountRepaid ?? 0) > 0 && !data.paidDate) || (data.status === 'paid' && !data.paidDate) ) {
    return false;
  }
  return true;
}, {
  message: 'تاريخ السداد مطلوب عندما تكون الحالة "تم السداد" أو "سداد جزئي" مع وجود مبلغ مسدد.',
  path: ['paidDate'],
}).refine(data => {
  // Require amountRepaid if status is paid or (partially_paid with amountRepaid > 0 implicitly needed)
  if ( (data.status === 'paid') && (data.amountRepaid === undefined || data.amountRepaid === null) ) {
     // For 'paid', amountRepaid *must* be present and equal to amount (checked below)
     return false;
  }
  // For 'partially_paid', amountRepaid is optional but must be non-negative if present
  return true;
}, {
  message: 'المبلغ المسدد مطلوب عندما تكون الحالة "تم السداد".',
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
}).refine(data => {
    // If outstanding, amountRepaid should be 0 or undefined/null
    if (data.status === 'outstanding' && (data.amountRepaid ?? 0) !== 0) {
        return false;
    }
    return true;
}, {
    message: 'في حالة "مستحق"، يجب أن يكون المبلغ المسدد صفر.',
    path: ['amountRepaid'],
});
type Debt = z.infer<typeof debtSchema>;

// Schema for the payment form (used when adding a new payment)
const paymentFormSchema = z.object({
  paymentAmount: z.coerce.number().positive({ message: 'مبلغ الدفعة يجب أن يكون أكبر من صفر.' }),
  paymentDate: z.date({ required_error: 'تاريخ الدفعة مطلوب.' }),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

// Schema for editing debt repayment
const repaymentFormSchema = z.object({
    amountRepaid: z.coerce.number().nonnegative({ message: 'المبلغ المسدد يجب أن يكون صفر أو أكثر.' }),
    paidDate: z.date({ required_error: 'تاريخ آخر سداد مطلوب.' }),
});
type RepaymentFormData = z.infer<typeof repaymentFormSchema>;


// Local storage keys
const CLIENT_STORAGE_KEY = 'clientTrackerDataV3'; // Incremented version
const PAYMENT_STORAGE_KEY = 'paymentTrackerDataV1'; // New key for payments
const DEBT_STORAGE_KEY = 'debtTrackerDataV1';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'; // Fetch rates relative to USD

// Type for exchange rates (USD to Other)
type ExchangeRates = {
    [key in Currency]?: number;
};


// ----- UTILITY FUNCTIONS -----

// Calculate total amount paid for a client from payments array
const calculateTotalPaid = (clientId: string, payments: Payment[]): number => {
  return payments
    .filter(p => p.clientId === clientId)
    .reduce((sum, p) => sum + p.amount, 0);
};

// Get the latest payment date for a client
const getLatestPaymentDate = (clientId: string, payments: Payment[]): Date | undefined => {
  const clientPayments = payments
    .filter(p => p.clientId === clientId)
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()); // Sort descending by date
  return clientPayments.length > 0 ? clientPayments[0].paymentDate : undefined;
};

// Determine payment status based on total paid and total cost
const determinePaymentStatus = (totalPaid: number, totalCost: number): PaymentStatus => {
    if (totalPaid <= 0) return 'not_paid';
    if (totalPaid >= totalCost) return 'paid';
    return 'partially_paid';
};

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
};

// Calculate remaining amount for a client
const calculateClientRemainingAmount = (totalCost: number, totalPaid: number): number => {
    return Math.max(0, totalCost - totalPaid);
};

// Calculate remaining debt amount
const calculateDebtRemainingAmount = (debt: Partial<Debt>): number => {
    if (!debt.amount || debt.amount <= 0) return 0;
    if (debt.status === 'paid') return 0;
    const repaid = debt.amountRepaid ?? 0;
    return Math.max(0, debt.amount - repaid);
};



// ----- COMPONENTS -----

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


// ----- MAIN PAGE COMPONENT -----

const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]); // State for payments
  const [debts, setDebts] = useState<Debt[]>([]); // State for debts
  const [clientSortConfig, setClientSortConfig] = useState<{ key: keyof Client | 'derivedStatus' | 'derivedAmountPaid' | 'derivedRemainingAmount' | 'derivedPaymentDate' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const [debtSortConfig, setDebtSortConfig] = useState<{ key: keyof Debt | 'remainingDebt' | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const { toast } = useToast();
  const toastRef = useRef(toast); // Create a ref for toast
  const [isMounted, setIsMounted] = useState(false); // Track mount state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null); // USD to OTHER rates
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState<string | null>(null);

  // State for managing which client's payment form is open
  const [addingPaymentForClientId, setAddingPaymentForClientId] = useState<string | null>(null);
  // State for managing which debt's repayment form is open
  const [editingRepaymentForDebtId, setEditingRepaymentForDebtId] = useState<string | null>(null);


  // Keep toast ref updated
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);


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

    // Load Clients
    const storedClients = localStorage.getItem(CLIENT_STORAGE_KEY);
    if (storedClients) {
      try {
        const parsedClients = JSON.parse(storedClients).map((client: any) => ({
          ...client,
          totalProjectCost: typeof client.totalProjectCost === 'number' ? client.totalProjectCost : 0,
          currency: client.currency || 'EGP', // Default to EGP if missing
          // Remove old payment status fields if they exist from previous versions
          paymentStatus: undefined,
          amountPaidSoFar: undefined,
          paymentDate: undefined,
        }));
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
      }
    }

    // Load Payments
    const storedPayments = localStorage.getItem(PAYMENT_STORAGE_KEY);
    if (storedPayments) {
        try {
            const parsedPayments = JSON.parse(storedPayments).map((payment: any) => ({
                ...payment,
                amount: typeof payment.amount === 'number' ? payment.amount : 0,
                paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(), // Ensure valid date
                currency: payment.currency || 'EGP', // Default currency if missing
            }));
            const validatedPayments = parsedPayments.filter((payment: any) => {
                try {
                    if (payment.paymentDate && isNaN(new Date(payment.paymentDate).getTime())) {
                        console.warn("Invalid paymentDate found in storage for payment:", payment.id);
                        payment.paymentDate = new Date(); // Default to today if invalid
                    }
                    paymentSchema.parse(payment);
                    return true;
                } catch (e) {
                    console.warn("Invalid payment data found in storage:", payment, e);
                    return false;
                }
            });
            setPayments(validatedPayments);
        } catch (error) {
            console.error("Failed to parse payments from local storage:", error);
        }
    }


    // Load debts
    const storedDebts = localStorage.getItem(DEBT_STORAGE_KEY);
    if (storedDebts) {
        try {
            const parsedDebts = JSON.parse(storedDebts).map((debt: any) => ({
                ...debt,
                amount: typeof debt.amount === 'number' ? debt.amount : 0,
                amountRepaid: typeof debt.amountRepaid === 'number' ? debt.amountRepaid : 0, // Default to 0 if missing/invalid
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

  // Save payments to local storage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payments));
    }
  }, [payments, isMounted]);

  // Save debts to local storage whenever the debts state changes, only after mount
  useEffect(() => {
    if (isMounted) { // Only run after component has mounted
        localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts));
    }
  }, [debts, isMounted]);


  // ----- FORM SETUP -----

  // Client Form (only for adding new clients)
  const clientForm = useForm<Client>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      project: '',
      totalProjectCost: 0,
      currency: 'EGP',
    },
  });

  // Payment Form (for adding new payments to existing clients)
  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentAmount: 0,
      paymentDate: new Date(),
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
          amountRepaid: 0, // Initialize with 0
          paidDate: undefined,
          notes: '',
      },
  });

   // Repayment Form (for editing existing debt repayment)
  const repaymentForm = useForm<RepaymentFormData>({
      resolver: zodResolver(repaymentFormSchema),
      // Default values will be set when the form is opened
  });

  // Watch debt form fields
  const debtStatus = debtForm.watch('status');
  const debtAmount = debtForm.watch('amount');
  const debtAmountRepaid = debtForm.watch('amountRepaid');
  const debtSelectedCurrency = debtForm.watch('currency');


  // Reset conditional debt fields when status changes in the main debt form
  useEffect(() => {
      if (debtStatus === 'outstanding') {
          debtForm.setValue('amountRepaid', 0); // Reset to 0 for outstanding
          debtForm.setValue('paidDate', undefined);
          debtForm.clearErrors(['amountRepaid', 'paidDate']);
      } else if (debtStatus === 'paid') {
          const totalAmount = debtForm.getValues('amount');
          if (totalAmount > 0) {
              debtForm.setValue('amountRepaid', totalAmount);
          }
          // Automatically set paidDate if not already set
          if (!debtForm.getValues('paidDate')) {
              debtForm.setValue('paidDate', new Date());
          }
      } else if (debtStatus === 'partially_paid') {
          // Automatically set paidDate if not already set and amountRepaid is positive
          if (!debtForm.getValues('paidDate') && (debtForm.getValues('amountRepaid') ?? 0) > 0) {
              debtForm.setValue('paidDate', new Date());
          }
      }
  }, [debtStatus, debtForm]);


  // ----- DATA MANIPULATION HANDLERS -----

  // Client Submit Handler (Only adds new clients)
  function onClientSubmit(values: Client) {
      const newClient = { ...values, id: crypto.randomUUID() }; // Generate a unique ID
      setClients((prevClients) => [...prevClients, newClient]);
      toast({ // Use direct toast call after checking for mount
        title: 'تمت إضافة العميل',
        description: `${values.name} تمت إضافته بنجاح.`,
      });
      clientForm.reset(); // Reset form fields after submission
  }

    // Payment Submit Handler (Adds a payment record for a specific client)
    function onPaymentSubmit(clientId: string, clientCurrency: Currency) {
        return (values: PaymentFormData) => {
            const client = clients.find(c => c.id === clientId);
            if (!client) return;

            const totalPaid = calculateTotalPaid(clientId, payments);
            const remaining = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);

            if (values.paymentAmount > remaining) {
                 paymentForm.setError('paymentAmount', {
                    type: 'manual',
                    message: `مبلغ الدفعة (${formatCurrency(values.paymentAmount, clientCurrency)}) يتجاوز المبلغ المتبقي (${formatCurrency(remaining, clientCurrency)}).`,
                 });
                 return; // Stop submission
            }

            const newPayment: Payment = {
                id: crypto.randomUUID(),
                clientId: clientId,
                amount: values.paymentAmount,
                paymentDate: values.paymentDate,
                currency: clientCurrency, // Use the client's currency for the payment
            };

            setPayments((prevPayments) => [...prevPayments, newPayment]);
            toast({ // Use direct toast call
                title: 'تمت إضافة دفعة',
                description: `تم تسجيل دفعة لـ ${client.name} بمبلغ ${formatCurrency(values.paymentAmount, clientCurrency)}.`,
            });
            paymentForm.reset(); // Reset payment form
            setAddingPaymentForClientId(null); // Close the form after submission
        };
    }


  // Debt Submit Handler
   function onDebtSubmit(values: Debt) {
       let finalValues = { ...values };

        // Ensure amountRepaid is 0 if status is outstanding
        if (finalValues.status === 'outstanding') {
            finalValues.amountRepaid = 0;
            finalValues.paidDate = undefined;
        } else if (finalValues.status === 'paid') {
            finalValues.amountRepaid = finalValues.amount; // Ensure repaid is full amount
             // Ensure paidDate is set, defaulting to now if not provided
            if (!finalValues.paidDate) {
                finalValues.paidDate = new Date();
            }
        } else { // partially_paid
             // Ensure amountRepaid is a number (default to 0 if undefined/null)
            finalValues.amountRepaid = finalValues.amountRepaid ?? 0;
            // Ensure paidDate is set if amountRepaid > 0, defaulting to now if not provided
            if (finalValues.amountRepaid > 0 && !finalValues.paidDate) {
                finalValues.paidDate = new Date();
            }
             // If amountRepaid is 0, clear paidDate
            if (finalValues.amountRepaid <= 0) {
                 finalValues.paidDate = undefined;
             }
        }


       const newDebt = { ...finalValues, id: crypto.randomUUID() };

       setDebts((prevDebts) => [...prevDebts, newDebt]);
       toast({ // Use direct toast call
           title: 'تمت إضافة الدين',
           description: `تمت إضافة الدين على ${values.debtorName} بنجاح.`,
       });
       debtForm.reset({ // Reset with default values, including amountRepaid: 0
            description: '',
            debtorName: '',
            creditorName: '',
            amount: 0,
            currency: 'EGP',
            dueDate: new Date(),
            status: 'outstanding',
            amountRepaid: 0,
            paidDate: undefined,
            notes: '',
       });
   }

    // Repayment Submit Handler (Updates an existing debt's repayment info)
    function onRepaymentSubmit(debtId: string) {
        return (values: RepaymentFormData) => {
            const debtIndex = debts.findIndex(d => d.id === debtId);
            if (debtIndex === -1) return;

            const originalDebt = debts[debtIndex];

            // Ensure repaid amount doesn't exceed total amount
            if (values.amountRepaid > originalDebt.amount) {
                repaymentForm.setError('amountRepaid', {
                    type: 'manual',
                    message: `المبلغ المسدد (${formatCurrency(values.amountRepaid, originalDebt.currency)}) لا يمكن أن يتجاوز مبلغ الدين الإجمالي (${formatCurrency(originalDebt.amount, originalDebt.currency)}).`,
                });
                return; // Stop submission
            }

             // Determine the new status based on the repaid amount
             let newStatus: DebtStatus = 'partially_paid';
             if (values.amountRepaid <= 0) {
                 newStatus = 'outstanding';
             } else if (values.amountRepaid >= originalDebt.amount) {
                 newStatus = 'paid';
                 values.amountRepaid = originalDebt.amount; // Ensure it's exactly the total amount if paid
             }


            const updatedDebt: Debt = {
                ...originalDebt,
                amountRepaid: values.amountRepaid,
                paidDate: values.paidDate, // Date of this specific repayment/update
                status: newStatus,
            };

            // Validate the final updated debt object
            const validationResult = debtSchema.safeParse(updatedDebt);

             if (!validationResult.success) {
                 console.error("Debt validation failed after repayment update:", validationResult.error);
                 toast({ // Use direct toast call
                     title: 'خطأ في تحديث السداد',
                     description: `فشل تحديث السداد. ${validationResult.error.errors?.[0]?.message || 'بيانات غير صالحة.'}`,
                     variant: 'destructive',
                 });
                 // Optionally show errors in the repayment form
                 validationResult.error.errors.forEach(err => {
                     if (err.path[0] === 'amountRepaid' || err.path[0] === 'paidDate') {
                        repaymentForm.setError(err.path[0] as keyof RepaymentFormData, { type: 'manual', message: err.message });
                     }
                 });
                 return;
            }

            // Update the debts array
            setDebts(prevDebts => {
                const newDebts = [...prevDebts];
                newDebts[debtIndex] = validationResult.data; // Use validated data
                return newDebts;
            });

            toast({ // Use direct toast call
                title: 'تم تحديث السداد',
                description: `تم تحديث المبلغ المسدد للدين على ${originalDebt.debtorName}. الحالة الآن ${DEBT_STATUSES[newStatus]}.`,
            });

            repaymentForm.reset(); // Reset repayment form
            setEditingRepaymentForDebtId(null); // Close the form
        };
    }


  const deleteClient = (idToDelete: string) => {
    setClients((prevClients) => prevClients.filter(client => client.id !== idToDelete));
    // Also delete associated payments
    setPayments((prevPayments) => prevPayments.filter(p => p.clientId !== idToDelete));
    toast({ // Use direct toast call
      title: 'تم حذف العميل',
      description: `تمت إزالة سجل العميل وجميع دفعاته.`,
      variant: 'destructive',
    });
  };

   const deletePayment = (paymentIdToDelete: string) => {
     const paymentToDelete = payments.find(p => p.id === paymentIdToDelete);
     if (!paymentToDelete) return;

     const client = clients.find(c => c.id === paymentToDelete.clientId);
     const clientName = client ? client.name : 'عميل غير معروف';

     setPayments((prevPayments) => prevPayments.filter(p => p.id !== paymentIdToDelete));
     toast({ // Use direct toast call
         title: 'تم حذف الدفعة',
         description: `تمت إزالة دفعة لـ ${clientName} بتاريخ ${formatDateAr(paymentToDelete.paymentDate)}.`,
         variant: 'destructive',
     });
   };


   const deleteDebt = (idToDelete: string) => {
       setDebts((prevDebts) => prevDebts.filter(debt => debt.id !== idToDelete));
       toast({ // Use direct toast call
           title: 'تم حذف الدين',
           description: `تمت إزالة سجل الدين.`,
           variant: 'destructive',
       });
        // Close edit form if the deleted debt was being edited
        if (editingRepaymentForDebtId === idToDelete) {
            setEditingRepaymentForDebtId(null);
        }
   };


   // Function to handle status updates triggered from the Select dropdown in Client Table
   const handleClientStatusChange = (clientId: string, newStatusTarget: PaymentStatus) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const totalPaid = calculateTotalPaid(clientId, payments);
        const currentStatus = determinePaymentStatus(totalPaid, client.totalProjectCost);

        if (newStatusTarget === currentStatus) return; // No change needed

        // --- Logic based on the *target* status ---

        if (newStatusTarget === 'paid') {
            // If trying to mark as paid but not fully paid
            if (totalPaid < client.totalProjectCost) {
                toast({ // Use direct toast call
                    title: 'لا يمكن التحديث إلى "تم الدفع"',
                    description: `العميل ${client.name} لم يسدد التكلفة الإجمالية بعد. المبلغ المتبقي ${formatCurrency(client.totalProjectCost - totalPaid, client.currency)}. قم بإضافة دفعة لتغطية المبلغ المتبقي.`,
                    variant: 'destructive',
                });
                // Revert visual state (needed if Select is uncontrolled within the table row)
                // Force a re-render might be the simplest way if not managing select state externally
                setClients([...clients]); // Trigger re-render
                return;
            }
             // If already fully paid, just confirm
            toast({ // Use direct toast call
                 title: 'تم التأكيد',
                 description: `حالة ${client.name} هي بالفعل "تم الدفع".`,
             });
             // No actual state change, but might need visual confirmation if select was optimistic
             setClients([...clients]); // Trigger re-render if needed

        } else if (newStatusTarget === 'partially_paid') {
            // If trying to mark as partially_paid but no payments exist
            if (totalPaid <= 0) {
                 toast({ // Use direct toast call
                    title: 'لا يمكن التحديث إلى "دفع جزئي"',
                    description: `العميل ${client.name} لم يقم بأي دفعات. قم بإضافة دفعة أولاً.`,
                    variant: 'destructive',
                 });
                setClients([...clients]); // Revert visual state
                return;
            }
            // If trying to mark as partially_paid but already fully paid
            if (totalPaid >= client.totalProjectCost) {
                 toast({ // Use direct toast call
                     title: 'تنبيه',
                     description: `العميل ${client.name} قام بالفعل بدفع التكلفة كاملة أو أكثر. الحالة هي "تم الدفع".`,
                     variant: 'default',
                 });
                 setClients([...clients]); // Revert visual state
                 return;
            }
             // If conditions met (paid > 0 and paid < totalCost)
            toast({ // Use direct toast call
                title: 'تم التأكيد',
                description: `حالة ${client.name} هي "دفع جزئي".`,
            });
             // Open payment form if transitioning from 'not_paid'
             if (currentStatus === 'not_paid') {
                 setAddingPaymentForClientId(clientId);
                 // Pre-fill with sensible defaults or 0?
                 paymentForm.reset({ paymentAmount: 0, paymentDate: new Date() });
             }
             // No actual data change needed, status is derived. Re-render ensures consistency.
             setClients([...clients]);

        } else if (newStatusTarget === 'not_paid') {
            // If trying to mark as 'not_paid' but payments exist
            if (totalPaid > 0) {
                toast({ // Use direct toast call
                    title: 'لا يمكن التحديث إلى "لم يتم الدفع"',
                    description: `توجد دفعات مسجلة للعميل ${client.name}. لحذف الدفعات وتغيير الحالة، قم بحذف سجلات الدفعات الفردية أولاً.`,
                    variant: 'destructive',
                });
                 setClients([...clients]); // Revert visual state
                return;
            }
            // If no payments exist, confirm status
             toast({ // Use direct toast call
                 title: 'تم التأكيد',
                 description: `حالة ${client.name} هي "لم يتم الدفع".`,
             });
             // No data change needed. Re-render ensures consistency.
             setClients([...clients]);
        }
   };


  // Function to handle status updates triggered from the Select dropdown in Debt Table
  const updateDebtStatus = (debtId: string, newStatus: DebtStatus) => {
      const debtIndex = debts.findIndex(d => d.id === debtId);
      if (debtIndex === -1) return;

      const originalDebt = debts[debtIndex];

      // If status is already the same, do nothing
      if (originalDebt.status === newStatus) return;

      let updatedDebt = { ...originalDebt, status: newStatus };
      let showRepaymentForm = false;
      let needsRepaymentUpdate = false;
      let toastMessage = '';

      if (newStatus === 'outstanding') {
          updatedDebt.amountRepaid = 0;
          updatedDebt.paidDate = undefined;
          toastMessage = `تم تحديث حالة الدين على "${originalDebt.debtorName}" إلى "مستحق". تم تصفير المبلغ المسدد.`;
          // Close repayment form if open for this debt
          if (editingRepaymentForDebtId === debtId) {
               setEditingRepaymentForDebtId(null);
          }
      } else if (newStatus === 'paid') {
          updatedDebt.amountRepaid = originalDebt.amount;
          // Set paid date to now only if it wasn't already set or if coming from outstanding/partially_paid
          if (!updatedDebt.paidDate || originalDebt.status !== 'paid') {
              updatedDebt.paidDate = new Date();
          }
          toastMessage = `تم تحديث حالة الدين على "${originalDebt.debtorName}" إلى "تم السداد".`;
           // Close repayment form if open
           if (editingRepaymentForDebtId === debtId) {
              setEditingRepaymentForDebtId(null);
           }
      } else { // partially_paid
          // If coming from 'paid', reset amountRepaid to previous value or prompt
          if (originalDebt.status === 'paid') {
              // Revert amountRepaid to something less than total? Or prompt?
              // For simplicity, let's keep the full amount but prompt user to adjust.
              // updatedDebt.amountRepaid = originalDebt.amountRepaid ?? 0; // Keep previous repaid amount if available?
               toastMessage = `تم تحديث حالة الدين على "${originalDebt.debtorName}" إلى "سداد جزئي". يرجى تعديل المبلغ المسدد.`;
               needsRepaymentUpdate = true; // Prompt user to update
               showRepaymentForm = true; // Open form to force update
          } else { // Coming from 'outstanding'
               // amountRepaid should ideally be updated via the form
               updatedDebt.amountRepaid = originalDebt.amountRepaid ?? 0; // Keep current (likely 0)
               toastMessage = `تم تحديث حالة الدين على "${originalDebt.debtorName}" إلى "سداد جزئي". قم بتحديث المبلغ المسدد.`;
               needsRepaymentUpdate = true;
               showRepaymentForm = true; // Open form to input amount
               // Pre-fill repayment form with 0 amount and today's date
               repaymentForm.reset({
                   amountRepaid: 0,
                   paidDate: new Date(),
               });

          }
           // Set paid date to now if amountRepaid > 0 and no date exists, or if coming from outstanding
          if (updatedDebt.amountRepaid > 0 && (!updatedDebt.paidDate || originalDebt.status === 'outstanding')) {
              updatedDebt.paidDate = new Date();
          } else if (updatedDebt.amountRepaid <= 0) {
              updatedDebt.paidDate = undefined; // Clear date if no repayment
          }
      }

      // Validate before updating state
      const validationResult = debtSchema.safeParse(updatedDebt);
      if (!validationResult.success) {
           console.error("Validation failed during debt status update:", validationResult.error);
           toast({ // Use direct toast call
               title: 'خطأ في تحديث الحالة',
               description: `فشل تحديث حالة الدين. ${validationResult.error.errors?.[0]?.message || 'بيانات غير صالحة.'}`,
               variant: 'destructive',
           });
           // Revert visual state in Select (important if uncontrolled)
           setDebts([...debts]); // Trigger re-render
           return; // Stop the update
      }

      // Update state with validated data
       setDebts(prevDebts => {
           const newDebts = [...prevDebts];
           newDebts[debtIndex] = validationResult.data;
           return newDebts;
       });

       // Show confirmation toast
       toast({ // Use direct toast call
           title: 'تم تحديث الحالة',
           description: toastMessage,
       });

        // Open the repayment form if needed
        if (showRepaymentForm) {
            // Pre-fill form with current values (or reset values if coming from outstanding)
            if (originalDebt.status !== 'outstanding') {
                 repaymentForm.reset({
                    amountRepaid: updatedDebt.amountRepaid,
                    paidDate: updatedDebt.paidDate || new Date(), // Default to now if no date
                });
            } // Keep reset values if coming from outstanding
            setEditingRepaymentForDebtId(debtId);
        }
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


   // ----- SORTING LOGIC -----

  const requestClientSort = (key: keyof Client | 'derivedStatus' | 'derivedAmountPaid' | 'derivedRemainingAmount' | 'derivedPaymentDate') => {
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


  const sortedClients = useMemo(() => {
    if (!isMounted) return []; // Return empty array during SSR or before mount

    // Map clients to include derived fields for sorting
    const clientsWithDerivedData = clients.map(client => {
        const totalPaid = calculateTotalPaid(client.id!, payments);
        const status = determinePaymentStatus(totalPaid, client.totalProjectCost);
        const remainingAmount = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);
        const latestPaymentDate = getLatestPaymentDate(client.id!, payments);
        return {
            ...client,
            derivedStatus: status,
            derivedAmountPaid: totalPaid,
            derivedRemainingAmount: remainingAmount,
            derivedPaymentDate: latestPaymentDate,
        };
    });


    return clientsWithDerivedData.sort((a, b) => {
        if (!clientSortConfig.key) return 0;

        let aValue, bValue;

        // Handle derived keys
        if (clientSortConfig.key === 'derivedStatus') {
             aValue = PAYMENT_STATUSES[a.derivedStatus]; // Sort by display name
             bValue = PAYMENT_STATUSES[b.derivedStatus];
         } else if (clientSortConfig.key === 'derivedAmountPaid') {
            aValue = a.derivedAmountPaid;
            bValue = b.derivedAmountPaid;
        } else if (clientSortConfig.key === 'derivedRemainingAmount') {
            aValue = a.derivedRemainingAmount;
            bValue = b.derivedRemainingAmount;
        } else if (clientSortConfig.key === 'derivedPaymentDate') {
            aValue = a.derivedPaymentDate;
            bValue = b.derivedPaymentDate;
        } else {
            // Handle direct client keys
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
  }, [clients, payments, clientSortConfig, isMounted]);

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


   // ----- UI HELPER COMPONENTS -----

  const SortableClientHeader = ({ columnKey, title }: { columnKey: keyof Client | 'derivedStatus' | 'derivedAmountPaid' | 'derivedRemainingAmount' | 'derivedPaymentDate', title: string }) => (
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



   // ----- CALCULATED TOTALS -----

  const totalPaidUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return payments.reduce((sum, payment) => {
          const amountInUSD = convertToUSD(payment.amount, payment.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
  }, [payments, isMounted, exchangeRates, rateLoading, convertToUSD]); // Depends on payments now

    const totalRemainingUSD = useMemo(() => {
      if (!isMounted || rateLoading || !exchangeRates) return null;
      return clients.reduce((sum, client) => {
          const totalPaid = calculateTotalPaid(client.id!, payments);
          const remainingAmount = calculateClientRemainingAmount(client.totalProjectCost, totalPaid);
          const amountInUSD = convertToUSD(remainingAmount, client.currency);
          return sum + (amountInUSD ?? 0);
      }, 0);
    }, [clients, payments, isMounted, exchangeRates, rateLoading, convertToUSD]); // Depends on clients and payments

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


 // ----- CHART DATA -----

 // Process data for the chart (individual payments in USD over time)
 const chartData: ChartData[] | null = useMemo(() => {
   if (!isMounted || rateLoading || !exchangeRates) return null; // Return null if rates not ready

   const now = new Date();
   const startOfMonth = dateFnsStartOfMonth(now);
   const endOfMonth = dateFnsEndOfMonth(now);

   // Filter payments within the current month and convert to USD
   const paymentsInMonthUSD = payments
     .filter(
       (payment) =>
         payment.paymentDate &&
         !isNaN(payment.paymentDate.getTime()) &&
         payment.paymentDate >= startOfMonth &&
         payment.paymentDate <= endOfMonth
     )
     .map(payment => ({
       date: payment.paymentDate!, // Keep the original date object
       amountUSD: convertToUSD(payment.amount, payment.currency) ?? 0,
       clientName: clients.find(c => c.id === payment.clientId)?.name || 'عميل غير معروف',
       originalAmount: payment.amount,
       originalCurrency: payment.currency,
     }))
     .filter(p => p.amountUSD > 0) // Only include payments with a positive USD amount
     .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort payments by date

   // Map to the structure required by the chart, adding a formatted date string
    const chartEntries = paymentsInMonthUSD.map((payment, index) => ({
        // Use a unique identifier including index in case of same-day payments
        id: `${format(payment.date, 'yyyy-MM-dd')}-${index}`,
        date: payment.date, // Keep the Date object for potential future use
        dateFormatted: format(payment.date, 'd MMM', { locale: arSA }), // Arabic date format for X-axis label
        amountUSD: payment.amountUSD,
        clientName: payment.clientName,
        originalAmount: payment.originalAmount,
        originalCurrency: payment.originalCurrency,
    }));

    return chartEntries.length > 0 ? chartEntries : []; // Return empty array if no payments

 }, [payments, clients, isMounted, exchangeRates, rateLoading, convertToUSD]);



  // ----- RENDER LOGIC -----

  if (!isMounted) {
    // Render a loading state or null during SSR/pre-mount
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-foreground">جاري تحميل البيانات...</p>
        </div>
    );
  }


  // Calculate remaining amount for debt form
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

                         {/* Conditional Fields for Debt Repayment in Main Form */}
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
                                                  value={field.value ?? ''} // Handle undefined/null for input value
                                                  onChange={(e) => {
                                                      // Convert empty string or invalid number to undefined, otherwise parse float
                                                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                      field.onChange(isNaN(value as number) ? undefined : value); // Pass undefined if NaN
                                                  }}
                                                  disabled={debtStatus === 'paid'} // Disable if fully paid in main form
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


       {/* Payment Chart Card (Individual Payments USD for current month) */}
        <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
           <CardHeader className="bg-muted/50">
             <CardTitle className="text-xl text-foreground">الدفعات الفردية الشهرية (بالدولار الأمريكي - تقديري)</CardTitle>
             <AlertDescription className="text-muted-foreground mt-2">
                ملاحظة: يمثل الرسم البياني كل دفعة فردية مقدرة بالدولار الأمريكي لهذا الشهر. مرر فوق النقاط لرؤية التفاصيل.
             </AlertDescription>
           </CardHeader>
           <CardContent className="p-4 md:p-6">
             {chartData && chartData.length > 0 ? (
               <ClientPaymentChart data={chartData} />
             ) : rateLoading ? (
                 <div className="flex items-center justify-center h-[300px]">
                   <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                   <p className="ml-2 text-muted-foreground">جاري تحميل بيانات الرسم البياني...</p>
                 </div>
              ) : rateError ? (
                 <Alert variant="destructive" className="h-[300px] flex flex-col items-center justify-center">
                   <AlertCircle className="h-6 w-6 mb-2"/>
                   <AlertTitle>لا يمكن عرض الرسم البياني</AlertTitle>
                   <AlertDescription>تعذر تحميل الرسم البياني للدخل بسبب خطأ في جلب سعر الصرف.</AlertDescription>
                 </Alert>
              ) : (
                 <Alert className="h-[300px] flex flex-col items-center justify-center shadow border border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300">
                   <AlertCircle className="h-6 w-6 mb-2" />
                   <AlertTitle>لا توجد بيانات لعرضها</AlertTitle>
                   <AlertDescription>لا توجد دفعات مسجلة لهذا الشهر لعرضها في الرسم البياني.</AlertDescription>
                 </Alert>
             )}
           </CardContent>
         </Card>


      {/* Client Records Card */}
      <Card className="mb-8 shadow-lg border border-border rounded-lg overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-xl text-foreground">سجلات العملاء</CardTitle>
        </CardHeader>
        <CardContent className="pt-0"> {/* Remove top padding as header provides it */}
          <Table>
            <TableCaption className="mt-4 mb-2 text-muted-foreground">قائمة بعملائك ومشاريعهم وحالات الدفع.</TableCaption>
            <TableHeader>
              <TableRow>
                <SortableClientHeader columnKey="name" title="اسم العميل" />
                <SortableClientHeader columnKey="project" title="المشروع" />
                <SortableClientHeader columnKey="totalProjectCost" title="التكلفة الإجمالية" />
                 <TableHead>العملة</TableHead>
                <SortableClientHeader columnKey="derivedStatus" title="حالة الدفع" />
                <SortableClientHeader columnKey="derivedAmountPaid" title="المدفوع" />
                <SortableClientHeader columnKey="derivedRemainingAmount" title="المتبقي" />
                <TableHead>المتبقي (دولار)</TableHead>
                <SortableClientHeader columnKey="derivedPaymentDate" title="تاريخ آخر دفعة" />
                <TableHead className="text-left">الإجراءات</TableHead>{/* Adjusted alignment for RTL */}
              </TableRow>
            </TableHeader>
            <TableBody>{/* Ensure no whitespace */}
              {sortedClients.length > 0 ? (
                sortedClients.map((client) => {
                    // Use derived values directly from sortedClients
                    const { derivedStatus: paymentStatus, derivedAmountPaid: amountPaid, derivedRemainingAmount: remainingAmount, derivedPaymentDate: latestPaymentDate } = client;
                    const remainingAmountUSD = convertToUSD(remainingAmount, client.currency);
                    const isAddingPayment = addingPaymentForClientId === client.id;

                    return (
                      <React.Fragment key={client.id}> {/* Use Fragment to wrap row and potential form */}
                      <TableRow className="hover:bg-muted/30 transition-colors duration-150">
                        <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.project}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(client.totalProjectCost, client.currency)}</TableCell>
                        <TableCell className="text-muted-foreground">{CURRENCIES[client.currency]}</TableCell>
                        <TableCell>
                             <Select
                                value={paymentStatus} // Use derived status
                                onValueChange={(newStatus) => client.id && handleClientStatusChange(client.id, newStatus as PaymentStatus)}
                             >
                                <SelectTrigger className={cn(
                                    "w-[130px] text-xs border rounded-md py-1 px-2 focus:ring-1 focus:ring-ring focus:ring-offset-0", // Basic styling, adjust as needed
                                     paymentStatus === 'paid' && 'text-green-800 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
                                     paymentStatus === 'partially_paid' && 'text-yellow-800 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
                                     paymentStatus === 'not_paid' && 'text-red-800 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
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
                        <TableCell className="text-muted-foreground">{formatDateAr(latestPaymentDate)}</TableCell> {/* Use Arabic date format */}
                        <TableCell className="text-left space-x-1"> {/* Adjusted alignment for RTL & Added spacing */}
                           {/* Add/Edit Payment Button - Show if not fully paid */}
                           {paymentStatus !== 'paid' && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                  const newClientId = client.id === addingPaymentForClientId ? null : client.id;
                                  setAddingPaymentForClientId(newClientId);
                                  // Reset/Pre-fill form when opening
                                  if (newClientId) {
                                      paymentForm.reset({
                                          // Pre-fill with 0 or existing partial payment logic if needed
                                          paymentAmount: 0,
                                          paymentDate: new Date(),
                                      });
                                  }
                               }}
                               className={cn(
                                "text-xs",
                                isAddingPayment ? "bg-muted text-muted-foreground" : "" // Style when form is open
                               )}
                             >
                               {isAddingPayment ? 'إلغاء' : (amountPaid > 0 ? 'تعديل/إضافة دفعة' : 'إضافة دفعة')}
                               {!isAddingPayment && <Edit className="h-3 w-3 ml-1" />} {/* Add icon when not adding */}
                             </Button>
                           )}
                          <Button variant="ghost" size="icon" onClick={() => client.id && deleteClient(client.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف العميل</span>
                          </Button>
                        </TableCell>
                      </TableRow>

                       {/* Payment Form Row - Conditionally Rendered */}
                        {isAddingPayment && (
                            <TableRow className="bg-muted/10 border-t border-dashed">
                                <TableCell colSpan={10} className="p-4">
                                    <Form {...paymentForm}>
                                        <form
                                            onSubmit={paymentForm.handleSubmit(onPaymentSubmit(client.id!, client.currency))}
                                            className="flex flex-col sm:flex-row items-start sm:items-end gap-4"
                                        >
                                            <FormField
                                                control={paymentForm.control}
                                                name="paymentAmount"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormLabel>مبلغ الدفعة ({client.currency})</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder="أدخل المبلغ"
                                                                {...field}
                                                                step="0.01"
                                                                className="bg-background"
                                                                max={remainingAmount} // Limit input to remaining amount
                                                            />
                                                        </FormControl>
                                                         <FormDescription className="text-xs text-yellow-600 dark:text-yellow-400 pt-1 font-medium">
                                                              المبلغ المتبقي للمشروع: {formatCurrency(remainingAmount, client.currency)}
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={paymentForm.control}
                                                name="paymentDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel className="mb-1">تاريخ الدفعة</FormLabel> {/* Adjusted margin */}
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant={'outline'}
                                                                        className={cn(
                                                                            'w-[200px] sm:w-[240px] pr-3 text-right font-normal justify-between bg-background', // Adjusted width and alignment
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
                                            <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                تأكيد الدفعة
                                            </Button>
                                        </form>
                                    </Form>
                                      {/* Display individual payments */}
                                     <div className="mt-4 pt-4 border-t">
                                         <h4 className="text-sm font-medium mb-2">سجل الدفعات:</h4>
                                         {payments.filter(p => p.clientId === client.id).length > 0 ? (
                                             <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                                                 {payments
                                                     .filter(p => p.clientId === client.id)
                                                     .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()) // Show newest first
                                                     .map(p => (
                                                         <li key={p.id} className="flex justify-between items-center">
                                                             <span>{formatCurrency(p.amount, p.currency)} - {formatDateAr(p.paymentDate)}</span>
                                                             <Button variant="ghost" size="icon" onClick={() => deletePayment(p.id)} className="text-destructive hover:text-destructive/80 h-6 w-6">
                                                                 <Trash2 className="h-3 w-3" />
                                                                 <span className="sr-only">حذف الدفعة</span>
                                                             </Button>
                                                         </li>
                                                     ))}
                                             </ul>
                                         ) : (
                                             <p className="text-xs text-muted-foreground">لا توجد دفعات مسجلة لهذا العميل.</p>
                                         )}
                                     </div>
                                </TableCell>
                            </TableRow>
                        )}
                      </React.Fragment>
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
                      <TableRow>
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
                          <SortableDebtHeader columnKey="paidDate" title="آخر سداد" /> {/* Changed label */}
                          <TableHead>ملاحظات</TableHead>
                          <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>{/* Ensure no whitespace */}
                      {sortedDebts.length > 0 ? (
                          sortedDebts.map((debt) => {
                              const remainingDebt = calculateDebtRemainingAmount(debt);
                              const remainingDebtUSD = convertToUSD(remainingDebt, debt.currency);
                              const amountRepaid = debt.amountRepaid ?? 0;
                              const isEditingRepayment = editingRepaymentForDebtId === debt.id;

                              return (
                                 <React.Fragment key={debt.id}>
                                  <TableRow className="hover:bg-muted/30 transition-colors duration-150">
                                      <TableCell className="font-medium text-foreground">{debt.description}</TableCell>
                                      <TableCell className="text-muted-foreground">{debt.debtorName}</TableCell>
                                      <TableCell className="text-muted-foreground">{debt.creditorName}</TableCell>
                                      <TableCell className="font-semibold">{formatCurrency(debt.amount, debt.currency)}</TableCell>
                                      <TableCell className="text-muted-foreground">{CURRENCIES[debt.currency]}</TableCell>
                                      <TableCell>
                                          <Select
                                              value={debt.status} // Use current status
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
                                      <TableCell className="text-left space-x-1">
                                          {/* Edit Repayment Button - Show if not fully paid */}
                                           {debt.status !== 'paid' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const newDebtId = debt.id === editingRepaymentForDebtId ? null : debt.id;
                                                    setEditingRepaymentForDebtId(newDebtId);
                                                    // Pre-fill form when opening
                                                    if (newDebtId) {
                                                        repaymentForm.reset({
                                                            amountRepaid: debt.amountRepaid ?? 0,
                                                            paidDate: debt.paidDate || new Date(), // Default to now if no previous date
                                                        });
                                                    }
                                                }}
                                                className={cn(
                                                    "text-xs",
                                                    isEditingRepayment ? "bg-muted text-muted-foreground" : ""
                                                )}
                                            >
                                                {isEditingRepayment ? 'إلغاء' : 'تعديل السداد'}
                                                {!isEditingRepayment && <Edit className="h-3 w-3 ml-1" />}
                                            </Button>
                                            )}
                                          <Button variant="ghost" size="icon" onClick={() => debt.id && deleteDebt(debt.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                                              <Trash2 className="h-4 w-4" />
                                              <span className="sr-only">حذف</span>
                                          </Button>
                                      </TableCell>
                                  </TableRow>

                                   {/* Repayment Edit Form Row - Conditionally Rendered */}
                                    {isEditingRepayment && (
                                        <TableRow className="bg-muted/10 border-t border-dashed">
                                            <TableCell colSpan={13} className="p-4"> {/* Adjust colSpan */}
                                                <Form {...repaymentForm}>
                                                    <form
                                                        onSubmit={repaymentForm.handleSubmit(onRepaymentSubmit(debt.id!))}
                                                        className="flex flex-col sm:flex-row items-start sm:items-end gap-4"
                                                    >
                                                        <FormField
                                                            control={repaymentForm.control}
                                                            name="amountRepaid"
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    <FormLabel>المبلغ المسدد ({debt.currency})</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="أدخل المبلغ المسدد"
                                                                            {...field}
                                                                            step="0.01"
                                                                            className="bg-background"
                                                                            max={debt.amount} // Set max value
                                                                        />
                                                                    </FormControl>
                                                                     <FormDescription className="text-xs">
                                                                         المبلغ الإجمالي للدين: {formatCurrency(debt.amount, debt.currency)}
                                                                     </FormDescription>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={repaymentForm.control}
                                                            name="paidDate"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-col">
                                                                    <FormLabel className="mb-1">تاريخ آخر سداد</FormLabel>
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <FormControl>
                                                                                <Button
                                                                                    variant={'outline'}
                                                                                    className={cn(
                                                                                        'w-[200px] sm:w-[240px] pr-3 text-right font-normal justify-between bg-background',
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
                                                        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                                            حفظ التعديل
                                                        </Button>
                                                    </form>
                                                </Form>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                  </React.Fragment>
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
