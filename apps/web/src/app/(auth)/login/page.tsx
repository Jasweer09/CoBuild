'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your CoBuild account</p>
      </div>
      <form className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
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
            type="password"
            placeholder="Enter your password"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <button
          type="submit"
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign In
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
