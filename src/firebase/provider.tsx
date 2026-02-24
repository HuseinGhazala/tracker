'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initializeFirebase } from './index';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

interface FirebaseContextValue {
  services: FirebaseServices | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const firebaseServices = await initializeFirebase();
        setServices(firebaseServices);
      } catch (error) {
        console.error("Failed to initialize Firebase", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const value = useMemo(() => ({ services, loading }), [services, loading]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => {
  const { services } = useFirebase();
  return services?.firebaseApp ?? null;
};

export const useAuth = () => {
  const { services } = useFirebase();
  return services?.auth ?? null;
};

export const useFirestore = () => {
  const { services } = useFirebase();
  return services?.firestore ?? null;
};
