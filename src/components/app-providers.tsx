'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseClientProvider>{children}</FirebaseClientProvider>
    </QueryClientProvider>
  );
}
