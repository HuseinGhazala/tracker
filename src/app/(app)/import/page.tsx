'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthButtons } from '@/components/auth-buttons';

const ImportPage = () => {
  const { data: user, isLoading: userLoading } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientsFile, setClientsFile] = useState<File | null>(null);
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImport = async () => {
    if (!user?.uid) {
      toast({ title: 'سجّل الدخول أولاً', variant: 'destructive' });
      return;
    }
    if (!clientsFile && !paymentsFile) {
      toast({ title: 'اختر ملف العملاء و/أو ملف الدفعات', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      if (clientsFile) formData.append('clients', clientsFile);
      if (paymentsFile) formData.append('payments', paymentsFile);
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'x-user-id': user.uid },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'فشل الاستيراد', description: data.error || res.statusText, variant: 'destructive' });
        return;
      }
      setClientsFile(null);
      setPaymentsFile(null);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['clients', user.uid] }),
        queryClient.refetchQueries({ queryKey: ['payments', user.uid] }),
      ]);
      toast({
        title: 'تم الاستيراد بنجاح',
        description: `تم استيراد ${data.clientsImported ?? 0} عميل و ${data.paymentsImported ?? 0} دفعة. انتقل إلى «العملاء» في الشريط لعرض البيانات.`,
      });
    } catch (e: unknown) {
      toast({ title: 'خطأ', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground gap-4">
        <p>سجّل الدخول لاستيراد البيانات.</p>
        <AuthButtons />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">استيراد البيانات</h1>
        <p className="text-muted-foreground mt-1">
          ارفع ملفات CSV للعملاء و/أو الدفعات (بنفس تنسيق التصدير). سيتم ربطها تلقائياً بحسابك.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            رفع ملفات CSV
          </CardTitle>
          <CardDescription>
            الملفات يجب أن تحتوي على الأعمدة: العملاء (id, user_id, name, project, total_project_cost, currency, total_paid, created_at) والدفعات (id, user_id, client_id, amount, payment_date, currency, notes, created_at). يمكن أن يكون user_id هو &lt;REPLACE_WITH_YOUR_SUPABASE_USER_ID&gt; وسيُستبدل تلقائياً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">ملف العملاء (clients_export_*.csv)</label>
            <input
              type="file"
              accept=".csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground"
              onChange={(e) => setClientsFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">ملف الدفعات (payments_export_*.csv)</label>
            <input
              type="file"
              accept=".csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground"
              onChange={(e) => setPaymentsFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={handleImport} disabled={isUploading || (!clientsFile && !paymentsFile)}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                جاري الاستيراد...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-5" />
                استيراد البيانات
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportPage;
