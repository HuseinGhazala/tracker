'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { Loader2, LogIn, LogOut } from 'lucide-react';

export function AuthButtons() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useUser();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!auth) return;
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      queryClient.invalidateQueries({ queryKey: ['user'] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    } catch (e) {
      console.error(e);
    }
  };

  if (!auth || isLoading) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (user) {
    return (
      <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
        <LogOut className="h-4 w-4" />
        تسجيل الخروج
      </Button>
    );
  }

  return (
    <Button variant="default" size="sm" onClick={handleSignIn} disabled={isSigningIn} className="gap-2">
      {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      تسجيل الدخول بـ Google
    </Button>
  );
}
