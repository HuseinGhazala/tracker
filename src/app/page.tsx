
'use client';

import * as React from 'react'; // Added missing React import
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, ArrowUpDown, Trash2 } from 'lucide-react';

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

// Define the schema for client data
const clientSchema = z.object({
  id: z.string().optional(), // Optional for new clients, required for existing
  name: z.string().min(1, { message: 'Client name is required.' }),
  project: z.string().min(1, { message: 'Project description is required.' }),
  payment: z.coerce.number().positive({ message: 'Payment must be a positive number.' }),
  date: z.date({ required_error: 'Payment date is required.' }),
});

type Client = z.infer<typeof clientSchema>;

// Local storage key
const LOCAL_STORAGE_KEY = 'clientTrackerData';

const ClientTracker: FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Client | null; direction: 'ascending' | 'descending' }>({ key: null, direction: 'ascending' });
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false); // Track mount state

  // Load clients from local storage on initial render after mount
  useEffect(() => {
    setIsMounted(true); // Component is mounted
    const storedClients = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedClients) {
      try {
        const parsedClients = JSON.parse(storedClients).map((client: any) => ({
          ...client,
          date: new Date(client.date), // Ensure date is a Date object
        }));
        setClients(parsedClients);
      } catch (error) {
        console.error("Failed to parse clients from local storage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
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
      payment: 0,
      date: undefined, // Initialize date as undefined
    },
  });

  function onSubmit(values: Client) {
    const newClient = { ...values, id: crypto.randomUUID() }; // Generate a unique ID
    setClients((prevClients) => [...prevClients, newClient]);
    toast({
      title: 'Client Added',
      description: `${values.name} has been successfully added.`,
    });
    form.reset(); // Reset form fields after submission
    form.setValue('date', undefined as any);
  }

  const deleteClient = (idToDelete: string) => {
    setClients((prevClients) => prevClients.filter(client => client.id !== idToDelete));
    toast({
      title: 'Client Deleted',
      description: `Client record has been removed.`,
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

  const sortedClients = React.useMemo(() => {
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
          comparison = String(aValue).localeCompare(String(bValue));
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

  const totalPayment = React.useMemo(() => {
      if (!isMounted) return 0; // Return 0 during SSR or before mount
      return sortedClients.reduce((sum, client) => sum + (client.payment || 0), 0);
  }, [sortedClients, isMounted]); // Depend on isMounted


  if (!isMounted) {
    // Optional: Render a loading state or null during SSR/pre-mount
    // to prevent hydration issues related to local storage access.
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Client Tracker</h1>

      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle>Add New Client</CardTitle>
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
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} />
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
                      <FormLabel>Project Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project details" {...field} />
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
                      <FormLabel>Payment Amount</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter amount paid" {...field} step="0.01"/>
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
                       <FormLabel className="mb-2">Payment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90">Add Client</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Client Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of your clients for the month.</TableCaption>
            <TableHeader>
              <TableRow>
                <SortableHeader columnKey="name" title="Client Name" />
                <SortableHeader columnKey="project" title="Project" />
                <SortableHeader columnKey="payment" title="Payment" />
                <SortableHeader columnKey="date" title="Date" />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.length > 0 ? (
                sortedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.project}</TableCell>
                    <TableCell>{client.payment.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                    <TableCell>{format(client.date, 'PPP')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => client.id && deleteClient(client.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No clients added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
             <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                  <TableCell className="font-semibold">
                    {totalPayment.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
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
