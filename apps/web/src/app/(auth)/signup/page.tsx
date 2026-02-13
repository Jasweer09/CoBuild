'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function SignupPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      const res = await api.post<{
        user: { id: string; email: string; name: string; role: string; orgId: string; emailVerified: boolean };
        accessToken: string;
        refreshToken: string;
      }>('/auth/signup', { name, email, password });

      login(res.data.user, res.data.accessToken, res.data.refreshToken);
      toast.success('Account created! Check your email for verification.');
      router.push('/verify-email');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get started with CoBuild for free</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            placeholder="John Doe"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Min 8 characters"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
