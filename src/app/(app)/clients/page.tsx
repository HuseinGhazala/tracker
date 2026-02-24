'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar
} from '@/components/ui';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { CalendarIcon, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;
type Currency = keyof typeof CURRENCIES;

const clientSchema = z.object({
  name: z.string().min(1, 'اسم العميل مطلوب.'),
  project: z.string().min(1, 'وصف المشروع مطلوب.'),
  totalProjectCost: z.coerce.number().positive('يجب أن تكون التكلفة الإجمالية رقمًا موجبًا.'),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]]),
});

type ClientFormData = z.infer<typeof clientSchema>;

const paymentSchema = z.object({
    amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر.'),
    paymentDate: z.date(),
    notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const ClientsPage = () => {
  const firestore = useFirestore();
  const { data: user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null);

  const clientsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/clients`);
  }, [firestore, user]);

  const { data: clients, loading: clientsLoading } = useCollection(clientsQuery, {
      listen: true,
      // @ts-ignore
      idField: 'id',
  });

  const paymentsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/payments`);
  }, [firestore, user]);
  
  const { data: payments, loading: paymentsLoading } = useCollection(paymentsQuery, { 
      listen: true, 
      // @ts-ignore
      idField: 'id' 
  });

  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      project: '',
      totalProjectCost: 0,
      currency: 'EGP',
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        amount: 0,
        paymentDate: new Date(),
        notes: '',
    }
  });

  const onClientSubmit = async (data: ClientFormData) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, `users/${user.uid}/clients`), {
        ...data,
        createdAt: serverTimestamp(),
        totalPaid: 0,
      });
      toast({ title: 'تمت إضافة العميل بنجاح!' });
      clientForm.reset();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPaymentSubmit = async (clientId: string) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    const values = paymentForm.getValues();
    const client = clients?.find(c => c.id === clientId);

    if (!client) {
         toast({ title: 'خطأ', description: 'لم يتم العثور على العميل.', variant: 'destructive' });
         setIsSubmitting(false);
         return;
    }

    try {
        await addDoc(collection(firestore, `users/${user.uid}/payments`), {
            clientId,
            ...values,
            currency: client.currency,
            createdAt: serverTimestamp(),
        });
        
        // This should be a transaction in a real app
        const newTotalPaid = (client.totalPaid || 0) + values.amount;
        await updateDoc(doc(firestore, `users/${user.uid}/clients`, clientId), {
            totalPaid: newTotalPaid
        });

        toast({ title: 'تمت إضافة الدفعة بنجاح!' });
        paymentForm.reset();
        setAddingPaymentFor(null);

    } catch (error: any) {
         toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!firestore || !user) return;
     if (!confirm('هل أنت متأكد من حذف هذا العميل وجميع دفعاته؟')) return;

    try {
        // This should be a batched write in a real app
        const clientPayments = payments?.filter(p => p.clientId === clientId) || [];
        for (const payment of clientPayments) {
            await deleteDoc(doc(firestore, `users/${user.uid}/payments`, payment.id));
        }
        await deleteDoc(doc(firestore, `users/${user.uid}/clients`, clientId));
        toast({ title: 'تم حذف العميل بنجاح', variant: 'destructive' });
    } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  }
  
  const clientsWithPayments = useMemo(() => {
      if (!clients || !payments) return [];
      return clients.map(client => {
          const clientPayments = payments.filter(p => p.clientId === client.id);
          const totalPaid = clientPayments.reduce((acc, p) => acc + p.amount, 0);
          return {
              ...client,
              payments: clientPayments,
              totalPaid,
              remaining: client.totalProjectCost - totalPaid,
          }
      })
  }, [clients, payments]);


  const isLoading = clientsLoading || paymentsLoading;


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إضافة عميل جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Form Fields */}
                <FormField control={clientForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>اسم العميل</FormLabel><FormControl><Input placeholder="اسم العميل" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={clientForm.control} name="project" render={({ field }) => ( <FormItem><FormLabel>وصف المشروع</FormLabel><FormControl><Input placeholder="وصف المشروع" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={clientForm.control} name="totalProjectCost" render={({ field }) => ( <FormItem><FormLabel>التكلفة الإجمالية</FormLabel><FormControl><Input type="number" placeholder="التكلفة" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={clientForm.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="اختر العملة" /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name} ({code})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                إضافة عميل
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قائمة العملاء</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>المشروع</TableHead>
                <TableHead>التكلفة</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>المتبقي</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : clientsWithPayments.length > 0 ? (
                clientsWithPayments.map((client) => (
                  <React.Fragment key={client.id}>
                    <TableRow>
                      <TableCell>{client.name}</TableCell>
                      <TableCell>{client.project}</TableCell>
                      <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: client.currency }).format(client.totalProjectCost)}</TableCell>
                      <TableCell className="text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: client.currency }).format(client.totalPaid)}</TableCell>
                      <TableCell className="text-red-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: client.currency }).format(client.remaining)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setAddingPaymentFor(addingPaymentFor === client.id ? null : client.id)}>
                            {addingPaymentFor === client.id ? 'إلغاء' : 'إضافة دفعة'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {addingPaymentFor === client.id && (
                        <TableRow>
                            <TableCell colSpan={6} className="p-4 bg-muted/50">
                                <h4 className="font-semibold mb-2">إضافة دفعة لـ {client.name}</h4>
                                <Form {...paymentForm}>
                                    <form onSubmit={(e) => { e.preventDefault(); onPaymentSubmit(client.id); }} className="space-y-4">
                                        <FormField control={paymentForm.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" placeholder="مبلغ الدفعة" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>تاريخ الدفعة</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={'outline'} className={cn('w-[240px] pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: arSA }) : <span>اختر تاريخ</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date('1900-01-01')} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                        <FormField control={paymentForm.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Textarea placeholder="ملاحظات (اختياري)" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} حفظ الدفعة
                                        </Button>
                                    </form>
                                </Form>
                            </TableCell>
                        </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    لا يوجد عملاء. قم بإضافة عميل جديد للبدء.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsPage;
