'use client';

import { useEffect, useState } from 'react';
import { LoginFormClient } from './login-form-client';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-[400px] animate-pulse space-y-6">
      <div className="mb-10 space-y-2">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-9 rounded bg-muted" />
        <div className="h-9 rounded bg-muted" />
      </div>
      <div className="h-9 rounded bg-muted" />
    </div>
  );
}

/** Monta o form só no cliente — evita hydration mismatch do react-hook-form. */
export function LoginFormShell() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <LoginFormSkeleton />;
  return <LoginFormClient />;
}
