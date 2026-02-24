'use client';

import { useMemo } from 'react';
import { useAuth, useFirestore } from './provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCollectionQuery } from '@tanstack-query-firebase/react/firestore';
import type { User } from 'firebase/auth';
import {
  collection as fsCollection,
  query as fsQuery,
  where as fsWhere,
  type Query,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';

// Custom hook to get the current user's data
export function useUser() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const userQuery = useQuery<User | null, Error>({
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
    onSuccess: () => {
      // When the user changes, invalidate related data to trigger refetches
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  return userQuery;
}

// Custom hook to read a Firestore collection (optionally with where clause)
export function useCollection(
  input:
    | string
    | Query<DocumentData, DocumentData>
    | CollectionReference<DocumentData, DocumentData>
    | null,
  options: { where?: [string, any, any]; listen?: boolean; idField?: string } = {}
) {
  const firestore = useFirestore();
  const { data: user } = useUser();

  const collectionQuery = useMemo(() => {
    if (!firestore || !user) return null;
    if (typeof input !== 'string' && input) return input;
    if (typeof input === 'string') {
      let q = fsQuery(fsCollection(firestore, `users/${user.uid}/${input}`));
      if (options.where) {
        const [field, op, value] = options.where;
        q = fsQuery(q, fsWhere(field as string, op as any, value));
      }
      return q;
    }
    return null;
  }, [firestore, user, input, options.where]);

  const result = useCollectionQuery(collectionQuery as Query<DocumentData, DocumentData>, {
    enabled: !!collectionQuery,
  });

  const data =
    result.data?.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    })) ?? [];

  return { data, loading: result.isLoading, isError: result.isError, error: result.error };
}
