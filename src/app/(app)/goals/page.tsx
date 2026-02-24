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
  CardDescription,
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
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui';
import { Loader2, PlusCircle, Trash2, PiggyBank, Gem, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;
type Currency = keyof typeof CURRENCIES;

const savingsGoalSchema = z.object({
  name: z.string().min(1, 'اسم الهدف مطلوب.'),
  goalType: z.enum(['currency', 'gold']),
  targetAmount: z.coerce.number().positive('المبلغ المستهدف يجب أن يكون رقمًا موجبًا.'),
  currentAmount: z.coerce.number().nonnegative('المبلغ الحالي يجب أن يكون رقمًا موجبًا أو صفرًا.'),
  currency: z.enum(Object.keys(CURRENCIES) as [Currency, ...Currency[]]).optional(),
}).refine(data => {
    if (data.goalType === 'currency' && !data.currency) return false;
    return true;
}, { message: 'العملة مطلوبة لأهداف العملات النقدية.', path: ['currency'] })
.refine(data => data.currentAmount <= data.targetAmount, {
    message: 'المبلغ الحالي لا يمكن أن يتجاوز المبلغ المستهدف.', path: ['currentAmount'],
});

type SavingsGoalFormData = z.infer<typeof savingsGoalSchema>;

const addSavingsSchema = z.object({
    amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر.')
});
type AddSavingsFormData = z.infer<typeof addSavingsSchema>;


const SavingsGoalsPage = () => {
  const firestore = useFirestore();
  const { data: user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingToGoalId, setAddingToGoalId] = useState<string | null>(null);

  const goalsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `users/${user.uid}/goals`);
  }, [firestore, user]);

  const { data: goals, loading: goalsLoading } = useCollection(goalsQuery, { 
      listen: true,
      // @ts-ignore
      idField: 'id'
    });

  const goalForm = useForm<SavingsGoalFormData>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: {
      name: '',
      goalType: 'currency',
      targetAmount: 1000,
      currentAmount: 0,
      currency: 'EGP',
    },
  });

  const addSavingsForm = useForm<AddSavingsFormData>({
      resolver: zodResolver(addSavingsSchema),
      defaultValues: { amount: 0 }
  })

  const goalType = goalForm.watch('goalType');

  const onGoalSubmit = async (data: SavingsGoalFormData) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    let goalData: any = { ...data };
    if (data.goalType === 'gold') {
        delete goalData.currency;
    }

    try {
      await addDoc(collection(firestore, `users/${user.uid}/goals`), {
        ...goalData,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'تمت إضافة الهدف بنجاح!' });
      goalForm.reset();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAddSavingsSubmit = async (goalId: string) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    const goal = goals?.find(g => g.id === goalId);
    if(!goal) {
        toast({ title: 'خطأ', description: "لم يتم العثور على الهدف", variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }
    const { amount } = addSavingsForm.getValues();
    const newCurrentAmount = goal.currentAmount + amount;
    
    if (newCurrentAmount > goal.targetAmount) {
        addSavingsForm.setError('amount', { message: 'المبلغ الإجمالي يتجاوز الهدف.'});
        setIsSubmitting(false);
        return;
    }

    try {
        await updateDoc(doc(firestore, `users/${user.uid}/goals`, goalId), {
            currentAmount: newCurrentAmount
        });
        toast({title: 'تم تحديث المبلغ بنجاح'});
        addSavingsForm.reset();
        setAddingToGoalId(null);
    } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  }


  const handleDelete = async (id: string) => {
    if (!firestore || !user) return;
    if (!confirm('هل أنت متأكد من حذف هذا الهدف؟')) return;
    try {
        await deleteDoc(doc(firestore, `users/${user.uid}/goals`, id));
        toast({ title: 'تم حذف الهدف بنجاح', variant: 'destructive'})
    } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  }

  const formatAmount = (amount: number, unit?: 'gram' | Currency) => {
    if (!unit) return amount.toLocaleString('en-US');
    if (unit === 'gram') return `${amount.toLocaleString('en-US')} جرام`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: unit }).format(amount);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6 text-primary"/>إضافة هدف ادخاري</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...goalForm}>
            <form onSubmit={goalForm.handleSubmit(onGoalSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={goalForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>اسم الهدف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={goalForm.control} name="goalType" render={({ field }) => ( <FormItem><FormLabel>نوع الهدف</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="currency">عملة نقدية</SelectItem><SelectItem value="gold">ذهب</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={goalForm.control} name="targetAmount" render={({ field }) => ( <FormItem><FormLabel>{goalType === 'gold' ? 'الوزن المستهدف (جرام)' : 'المبلغ المستهدف'}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={goalForm.control} name="currentAmount" render={({ field }) => ( <FormItem><FormLabel>{goalType === 'gold' ? 'الوزن الحالي (جرام)' : 'المبلغ الحالي'}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                {goalType === 'currency' && (
                    <FormField control={goalForm.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>العملة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(CURRENCIES).map(([code, name]) => (<SelectItem key={code} value={code}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                )}
              </div>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                إضافة هدف
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div>
        <h2 className="text-2xl font-bold mb-4">أهدافي</h2>
        {goalsLoading ? (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : goals && goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(goal => {
                    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                    const unit = goal.goalType === 'gold' ? 'gram' : goal.currency;
                    const icon = goal.goalType === 'gold' ? <Gem className="h-5 w-5 text-yellow-500" /> : <PiggyBank className="h-5 w-5 text-green-500" />;
                    
                    return (
                        <Card key={goal.id} className="flex flex-col">
                           <CardHeader>
                               <CardTitle className="flex justify-between items-start">
                                   <div className="flex items-center gap-2">
                                       {icon}
                                       <span>{goal.name}</span>
                                   </div>
                                   <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)} className="text-destructive h-8 w-8 shrink-0">
                                       <Trash2 className="h-4 w-4" />
                                   </Button>
                               </CardTitle>
                               <CardDescription>{formatAmount(goal.targetAmount, unit)}</CardDescription>
                           </CardHeader>
                           <CardContent className="flex-grow space-y-4">
                               <div>
                                   <div className="flex justify-between items-baseline mb-1">
                                       <span className="text-lg font-bold text-primary">{formatAmount(goal.currentAmount, unit)}</span>
                                       <span className="text-sm text-muted-foreground">({progress.toFixed(1)}%)</span>
                                   </div>
                                   <Progress value={progress} className="h-3" />
                               </div>
                               {addingToGoalId === goal.id ? (
                                   <Form {...addSavingsForm}>
                                       <form onSubmit={addSavingsForm.handleSubmit(() => onAddSavingsSubmit(goal.id))} className="space-y-3 pt-2">
                                           <FormField control={addSavingsForm.control} name="amount" render={({ field }) => ( <FormItem><FormLabel className="text-xs">إضافة مبلغ</FormLabel><FormControl><Input type="number" {...field} step="0.01" /></FormControl><FormMessage /></FormItem> )} />
                                           <div className="flex gap-2">
                                               <Button type="submit" size="sm" className="flex-1" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد'}</Button>
                                               <Button type="button" variant="outline" size="sm" onClick={() => setAddingToGoalId(null)}>إلغاء</Button>
                                           </div>
                                       </form>
                                   </Form>
                               ) : (
                                   <Button onClick={() => setAddingToGoalId(goal.id)} className="w-full" disabled={goal.currentAmount >= goal.targetAmount}>
                                       <PlusCircle className="mr-2 h-4 w-4" /> إضافة مبلغ
                                   </Button>
                               )}
                           </CardContent>
                        </Card>
                    )
                })}
            </div>
        ) : (
            <Alert>
                <PiggyBank className="h-4 w-4" />
                <AlertTitle>لا توجد أهداف بعد!</AlertTitle>
                <AlertDescription>ابدأ بإضافة هدفك الادخاري الأول من النموذج أعلاه.</AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
};

export default SavingsGoalsPage;
