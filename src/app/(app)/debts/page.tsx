'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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

const DEBT_STATUSES = {
  outstanding: 'مستحق',
  paid: 'تم السداد',
  partially_paid: 'سداد جزئي',
} as const;
type DebtStatus = keyof typeof DEBT_STATUSES;

const debtSchema = z.object({
  description: z.string().min(1, 'الوصف مطلوب.'),
  debtorName: z.string().min(1, 'اسم المدين مطلوب.'),
  creditorName: z.string().min(1, 'اسم الدائن مطلوب.'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر.'),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]]),
  dueDate: z.date(),
  status: z.enum(Object.keys(DEBT_STATUSES) as [DebtStatus, ...DebtStatus[]]),
  amountRepaid: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

type DebtFormData = z.infer<typeof debtSchema>;

const DebtsPage = () => {
  const firestore = useFirestore();
  const { data: user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debtsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/debts`);
  }, [firestore, user]);

  const { data: debts, loading: debtsLoading } = useCollection(debtsQuery, { 
      listen: true, 
      // @ts-ignore
      idField: 'id' 
    });

  const form = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      description: '',
      debtorName: '',
      creditorName: '',
      amount: 0,
      currency: 'EGP',
      dueDate: new Date(),
      status: 'outstanding',
      amountRepaid: 0,
      notes: '',
    },
  });

  const onSubmit = async (data: DebtFormData) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, `users/${user.uid}/debts`), {
        ...data,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'تمت إضافة الدين بنجاح!' });
      form.reset();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (debtId: string) => {
    if (!firestore || !user) return;
    if (!confirm('هل أنت متأكد من حذف هذا الدين؟')) return;
    try {
        await deleteDoc(doc(firestore, `users/${user.uid}/debts`, debtId));
        toast({title: 'تم حذف الدين بنجاح', variant: 'destructive'})
    } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  }

  const handleStatusChange = async (debtId: string, newStatus: DebtStatus) => {
    if (!firestore || !user) return;
    try {
        const debtRef = doc(firestore, `users/${user.uid}/debts`, debtId);
        const debt = debts?.find(d => d.id === debtId);
        if (!debt) return;

        let updateData: any = { status: newStatus };
        if (newStatus === 'paid') {
            updateData.amountRepaid = debt.amount;
        }
        if (newStatus === 'outstanding') {
            updateData.amountRepaid = 0;
        }

        await updateDoc(debtRef, updateData);
        toast({title: 'تم تحديث حالة الدين'})
    } catch(error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إضافة دين جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>الوصف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="debtorName" render={({ field }) => ( <FormItem><FormLabel>المدين</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="creditorName" render={({ field }) => ( <FormItem><FormLabel>الدائن</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>تاريخ الاستحقاق</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: arSA }) : <span>اختر تاريخ</span>}<CalendarIcon className="ml-auto h-4 w-4" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(DEBT_STATUSES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="amountRepaid" render={({ field }) => ( <FormItem><FormLabel>المبلغ المسدد</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>ملاحظات</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                إضافة دين
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>قائمة الديون</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>الوصف</TableHead>
                          <TableHead>المدين</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>المتبقي</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>تاريخ الاستحقاق</TableHead>
                          <TableHead>الإجراءات</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {debtsLoading ? (
                           <TableRow>
                               <TableCell colSpan={7} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell>
                           </TableRow>
                      ) : debts && debts.length > 0 ? (
                        debts.map(debt => {
                            const remaining = debt.amount - (debt.amountRepaid || 0);
                            return (
                                <TableRow key={debt.id}>
                                    <TableCell>{debt.description}</TableCell>
                                    <TableCell>{debt.debtorName}</TableCell>
                                    <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: debt.currency }).format(debt.amount)}</TableCell>
                                    <TableCell className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: debt.currency }).format(remaining)}
                                    </TableCell>
                                    <TableCell>
                                        <Select value={debt.status} onValueChange={(value) => handleStatusChange(debt.id, value as DebtStatus)}>
                                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{Object.entries(DEBT_STATUSES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>{format(debt.dueDate.toDate(), 'PPP', { locale: arSA })}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(debt.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                      ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">لا توجد ديون مسجلة.</TableCell>
                        </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>
    </div>
  );
};

export default DebtsPage;
