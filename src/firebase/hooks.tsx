'use client';

import { useMemo } from 'react';
import { useAuth, useFirestore } from './provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFirestoreCollection } from '@tanstack-query-firebase/react';
import { collection, query, where } from 'firebase/firestore';

// Custom hook to get the current user's data
export function useUser() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: () => {
      return new Promise((resolve, reject) => {
        if (!auth) {
          return resolve(null);
        }
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        }, reject);
      });
    },
    initialData: auth?.currentUser,
    staleTime: Infinity, // User data is not expected to change frequently
    onChange: (newUser) => {
      // When the user changes, invalidate related data to trigger refetches
      queryClient.invalidateQueries(['collections']);
    },
  });

  return userQuery;
}

// Custom hook to subscribe to a Firestore collection
export function useCollection(path: string, options: any = {}) {
  const firestore = useFirestore();
  const { data: user } = useUser();

  const queryKey = useMemo(() => {
    return ['collections', path, options, user?.uid];
  }, [path, options, user?.uid]);

  const collectionQuery = useMemo(() => {
    if (!firestore || !user) return null;
    let q = query(collection(firestore, `users/${user.uid}/${path}`));
    if (options.where) {
      const [field, op, value] = options.where;
      q = query(q, where(field, op, value));
    }
    return q;
  }, [firestore, user, path, options.where]);

  const { data, isLoading, isError, error } = useFirestoreCollection(
    collectionQuery,
    {
      listen: options.listen !== false, // Listen for real-time updates by default
      idField: options.idField || 'id',
    }
  );

  return { data, loading: isLoading, isError, error };
}
