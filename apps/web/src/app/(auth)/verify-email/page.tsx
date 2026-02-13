'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function VerifyEmailPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setLoading(true);

    try {
      await api.post('/auth/verify-email', { email: user.email, code });
      toast.success('Email verified!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!user?.email) return;
    try {
      await api.post('/auth/resend-verification', { email: user.email });
      toast.success('Verification code resent');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resend');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to <strong>{user?.email || 'your email'}</strong>
        </p>
      </div>
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-foreground">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-2xl font-bold tracking-[0.5em] outline-none ring-ring focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Didn&apos;t receive a code?{' '}
        <button onClick={handleResend} className="font-medium text-primary hover:underline">
          Resend
        </button>
      </p>
    </div>
  );
}
