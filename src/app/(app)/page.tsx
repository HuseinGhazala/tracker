'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BarChart, Coins, Users, Wallet } from 'lucide-react';
import { useUser } from '@/firebase';
import { useQuery } from '@tanstack/react-query';
import { listClients, listPayments } from '@/services/supabase-data';

const DashboardPage = () => {
    const { data: user } = useUser();
    const { data: clients = [], isLoading: clientsLoading } = useQuery({
        queryKey: ['clients', user?.uid],
        queryFn: () => listClients(user!.uid),
        enabled: !!user?.uid,
    });
    const { data: payments = [], isLoading: paymentsLoading } = useQuery({
        queryKey: ['payments', user?.uid],
        queryFn: () => listPayments(user!.uid),
        enabled: !!user?.uid,
    });

    const stats = useMemo(() => {
        const totalClients = clients?.length ?? 0;
        const totalIncome = Array.isArray(clients)
            ? (clients as Array<{ total_paid?: number }>).reduce((sum, c) => sum + (Number(c.total_paid) || 0), 0)
            : 0;
        return {
            totalClients,
            totalDebts: 0,
            totalExpenses: 0,
            totalIncome,
        };
    }, [clients, payments]);

    const isLoading = clientsLoading || paymentsLoading;

    const formatCurrency = (amount: number, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
                سجّل الدخول لعرض لوحة التحكم والبيانات.
            </div>
        );
    }
    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[200px]">جاري تحميل البيانات...</div>;
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
