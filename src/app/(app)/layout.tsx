'use client';

import { FirebaseClientProvider } from '@/firebase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseClientProvider>{children}</FirebaseClientProvider>
    </QueryClientProvider>
  );
}
