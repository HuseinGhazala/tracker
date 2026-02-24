'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';

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

const appointmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'عنوان الموعد مطلوب.'),
  date: z.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صحيحة (HH:MM).'),
  attendees: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(Object.keys(APPOINTMENT_STATUSES) as [AppointmentStatus, ...AppointmentStatus[]]),
});
type Appointment = z.infer<typeof appointmentSchema>;

const taskSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'وصف المهمة مطلوب.'),
  dueDate: z.date().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(Object.keys(TASK_STATUSES) as [TaskStatus, ...TaskStatus[]]),
  notes: z.string().optional(),
});
type Task = z.infer<typeof taskSchema>;


const OrganizationPage = () => {
    const { toast } = useToast();
    const [appointments, setAppointments] = useLocalStorage<Appointment[]>('app_appointments', []);
    const [tasks, setTasks] = useLocalStorage<Task[]>('app_tasks', []);

    const appointmentForm = useForm<Appointment>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: { title: '', date: new Date(), time: '09:00', status: 'scheduled' }
    });

    const taskForm = useForm<Task>({
        resolver: zodResolver(taskSchema),
        defaultValues: { description: '', priority: 'medium', status: 'todo' }
    });

    const onAppointmentSubmit = (data: Appointment) => {
        setAppointments([...appointments, { ...data, id: crypto.randomUUID() }]);
        toast({ title: 'تمت إضافة الموعد بنجاح' });
        appointmentForm.reset();
    }

    const onTaskSubmit = (data: Task) => {
        setTasks([...tasks, { ...data, id: crypto.randomUUID() }]);
        toast({ title: 'تمت إضافة المهمة بنجاح' });
        taskForm.reset();
    }
    
    const deleteAppointment = (id: string) => {
        setAppointments(appointments.filter(a => a.id !== id));
        toast({title: 'تم حذف الموعد', variant: 'destructive'});
    }
    
    const deleteTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
        toast({title: 'تم حذف المهمة', variant: 'destructive'});
    }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Appointments Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>إضافة موعد جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...appointmentForm}>
              <form onSubmit={appointmentForm.handleSubmit(onAppointmentSubmit)} className="space-y-4">
                  <FormField control={appointmentForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>العنوان</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={appointmentForm.control} name="date" render={({ field }) => ( <FormItem><FormLabel>التاريخ</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn('w-full justify-start text-left font-normal',!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: arSA }) : <span>اختر تاريخ</span>}<CalendarIcon className="mr-auto h-4 w-4" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                    <FormField control={appointmentForm.control} name="time" render={({ field }) => ( <FormItem><FormLabel>الوقت</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                  <FormField control={appointmentForm.control} name="status" render={({ field }) => ( <FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(APPOINTMENT_STATUSES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField control={appointmentForm.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <Button type="submit"><PlusCircle className="mr-2 h-4 w-4" /> إضافة موعد</Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>المواعيد القادمة</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {appointments.length > 0 ? appointments.map(apt => (
                            <TableRow key={apt.id}>
                                <TableCell>{apt.title}</TableCell>
                                <TableCell>{format(new Date(apt.date), 'Pp', { locale: arSA })}</TableCell>
                                <TableCell>{APPOINTMENT_STATUSES[apt.status]}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => deleteTask(apt.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="text-center">لا توجد مواعيد.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      {/* Tasks Section */}
      <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle>إضافة مهمة جديدة</CardTitle></CardHeader>
            <CardContent>
                 <Form {...taskForm}>
                    <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                        <FormField control={taskForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>الوصف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={taskForm.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>تاريخ الاستحقاق</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn('w-full justify-start text-left font-normal',!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: arSA }) : <span>اختر تاريخ</span>}<CalendarIcon className="mr-auto h-4 w-4" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        <FormField control={taskForm.control} name="priority" render={({ field }) => ( <FormItem><FormLabel>الأولوية</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="low">منخفضة</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="high">عالية</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                        <FormField control={taskForm.control} name="status" render={({ field }) => ( <FormItem><FormLabel>الحالة</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.entries(TASK_STATUSES).map(([key, name]) => (<SelectItem key={key} value={key}>{name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                        <Button type="submit"><PlusCircle className="mr-2 h-4 w-4" /> إضافة مهمة</Button>
                    </form>
                 </Form>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>قائمة المهام</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>المهمة</TableHead><TableHead>الأولوية</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {tasks.length > 0 ? tasks.map(task => (
                            <TableRow key={task.id}>
                                <TableCell>{task.description}</TableCell>
                                <TableCell>{task.priority}</TableCell>
                                <TableCell>{TASK_STATUSES[task.status]}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => deleteTask(task.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="text-center">لا توجد مهام.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrganizationPage;
