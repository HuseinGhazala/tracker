'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  addDoc,
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

const expenseSchema = z.object({
  description: z.string().min(1, 'وصف المصروف مطلوب.'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون رقمًا موجبًا.'),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]]),
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]]),
  expenseDate: z.date(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

const ExpensesPage = () => {
  const firestore = useFirestore();
  const { data: user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expensesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/expenses`);
  }, [firestore, user]);

  const { data: expenses, loading: expensesLoading } = useCollection(expensesQuery, { 
      listen: true, 
      // @ts-ignore
      idField: 'id' 
    });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      currency: 'EGP',
      category: 'other',
      expenseDate: new Date(),
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, `users/${user.uid}/expenses`), {
        ...data,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'تمت إضافة المصروف بنجاح!' });
      form.reset();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!firestore || !user) return;
      if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
      try {
          await deleteDoc(doc(firestore, `users/${user.uid}/expenses`, id));
          toast({ title: 'تم حذف المصروف بنجاح', variant: 'destructive'})
      } catch (error: any) {
          toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إضافة مصروف جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>الوصف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>المبلغ</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="category" render={({ field }) => ( <FormItem><FormLabel>الفئة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(EXPENSE_CATEGORIES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="expenseDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>تاريخ المصروف</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: arSA }) : <span>اختر تاريخ</span>}<CalendarIcon className="ml-auto h-4 w-4" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                إضافة مصروف
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>قائمة المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>الوصف</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>الفئة</TableHead>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>الإجراءات</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {expensesLoading ? (
                           <TableRow>
                               <TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></TableCell>
                           </TableRow>
                      ) : expenses && expenses.length > 0 ? (
                        expenses.map(expense => (
                            <TableRow key={expense.id}>
                                <TableCell>{expense.description}</TableCell>
                                <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: expense.currency }).format(expense.amount)}</TableCell>
                                <TableCell>{EXPENSE_CATEGORIES[expense.category as ExpenseCategory]}</TableCell>
                                <TableCell>{format(expense.expenseDate.toDate(), 'PPP', { locale: arSA })}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                      ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">لا توجد مصروفات مسجلة.</TableCell>
                        </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesPage;
