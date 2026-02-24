'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BarChart, Coins, Users, Wallet } from 'lucide-react';
import { useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

const DashboardPage = () => {
    const firestore = useFirestore();
    const { data: user } = useUser();

    const clientsQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/clients`));
    }, [firestore, user]);
    const { data: clients, loading: clientsLoading } = useCollection(clientsQuery);

    const debtsQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/debts`));
    }, [firestore, user]);
    const { data: debts, loading: debtsLoading } = useCollection(debtsQuery);
    
    const expensesQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/expenses`));
    }, [firestore, user]);
    const { data: expenses, loading: expensesLoading } = useCollection(expensesQuery);


    const stats = useMemo(() => {
        const totalClients = clients?.length ?? 0;
        const totalDebts = debts?.reduce((sum, debt) => sum + (debt.status !== 'paid' ? (debt.amount - (debt.amountRepaid || 0)) : 0), 0) ?? 0;
        const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0;
        // This is a simplified calculation. A real app would need exchange rates.
        const totalIncome = clients?.reduce((sum, client) => sum + (client.totalPaid || 0), 0) ?? 0;

        return {
            totalClients,
            totalDebts,
            totalExpenses,
            totalIncome,
        };
    }, [clients, debts, expenses]);

    const isLoading = clientsLoading || debtsLoading || expensesLoading;

    const formatCurrency = (amount: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    }

    if (isLoading) {
        return <div>Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</div>
                        <p className="text-xs text-muted-foreground">Across all clients</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalClients}</div>
                        <p className="text-xs text-muted-foreground">Current active clients</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Debts</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalDebts)}</div>
                        <p className="text-xs text-muted-foreground">Money owed to you</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>An overview of recent financial movements.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Placeholder for recent activity feed */}
                        <p className="text-muted-foreground">No recent activity to display.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Financial Analysis</CardTitle>
                         <CardDescription>AI-powered insights into your finances.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {/* Placeholder for AI analysis component */}
                        <p className="text-muted-foreground">AI analysis feature coming soon.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;
