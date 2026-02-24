'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';

// This provider ensures that Firebase is initialized only on the client side.
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Render children within FirebaseProvider only on the client
  return isClient ? <FirebaseProvider>{children}</FirebaseProvider> : <>{children}</>;
}
