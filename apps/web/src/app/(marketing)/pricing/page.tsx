'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  name: string;
  type: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'ADD_ON';
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  features: {
    chatbots: number;
    messagesPerMonth: number;
    crawlPages: number;
    fileUploads: number;
    qnaPairs: number;
  } | null;
  isActive: boolean;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function featureLabel(name: string): string {
  const map: Record<string, string> = {
    chatbots: 'Chatbots',
    messagesPerMonth: 'Messages / Month',
    crawlPages: 'Crawl Pages',
    fileUploads: 'File Uploads',
    qnaPairs: 'Q&A Pairs',
  };
  return map[name] || name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function formatFeatureValue(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const { data, isLoading } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: () => api.get<{ plans: Plan[] }>('/billing/plans'),
  });

  const plans = (data?.data?.plans ?? [])
    .filter((p) => p.isActive && p.type !== 'ADD_ON')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function getCtaConfig(plan: Plan) {
    switch (plan.type) {
      case 'FREE':
        return { label: 'Get Started', href: '/signup' };
      case 'BASIC':
      case 'PREMIUM':
        return { label: 'Start Free Trial', href: '/signup' };
      case 'ENTERPRISE':
        return { label: 'Contact Sales', href: 'mailto:sales@cobuild.ai?subject=Enterprise Plan Inquiry' };
      default:
        return { label: 'Get Started', href: '/signup' };
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-foreground">
            Co<span className="text-primary">Build</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Choose the perfect plan for your business. Start free and scale as you grow.
          All plans include core features with no hidden fees.
        </p>

        {/* Billing period toggle */}
        <div className="mb-12 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${
              billingPeriod === 'MONTHLY' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBillingPeriod((prev) =>
                prev === 'MONTHLY' ? 'YEARLY' : 'MONTHLY',
              )
            }
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              billingPeriod === 'YEARLY' ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                billingPeriod === 'YEARLY' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${
              billingPeriod === 'YEARLY' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Yearly
          </span>
          {billingPeriod === 'YEARLY' && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Save 20%
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        )}

        {/* Plan cards */}
        {!isLoading && plans.length > 0 && (
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const cta = getCtaConfig(plan);
              const price =
                billingPeriod === 'MONTHLY'
                  ? plan.priceMonthly
                  : plan.priceYearly;
              const isRecommended = plan.type === 'PREMIUM';

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-8 text-left transition-shadow hover:shadow-lg ${
                    isRecommended
                      ? 'border-primary bg-card shadow-md ring-1 ring-primary/20'
                      : 'border-border bg-card'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    {plan.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="mb-6">
                    {plan.type === 'FREE' ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">$0</span>
                        <span className="text-muted-foreground">/forever</span>
                      </div>
                    ) : plan.type === 'ENTERPRISE' ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">Custom</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-foreground">
                            {formatCurrency(price)}
                          </span>
                          <span className="text-muted-foreground">
                            /{billingPeriod === 'MONTHLY' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        {billingPeriod === 'YEARLY' && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Billed annually ({formatCurrency(parseFloat(price) / 12)}/month)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features list */}
                  {plan.features && (
                    <ul className="mb-8 flex-1 space-y-3">
                      <PricingFeatureRow
                        label="Chatbots"
                        value={plan.features.chatbots}
                      />
                      <PricingFeatureRow
                        label="Messages / month"
                        value={plan.features.messagesPerMonth}
                      />
                      <PricingFeatureRow
                        label="Crawl pages"
                        value={plan.features.crawlPages}
                      />
                      <PricingFeatureRow
                        label="File uploads"
                        value={plan.features.fileUploads}
                      />
                      <PricingFeatureRow
                        label="Q&A pairs"
                        value={plan.features.qnaPairs}
                      />
                    </ul>
                  )}

                  {plan.type === 'ENTERPRISE' && (
                    <ul className="mb-8 flex-1 space-y-3">
                      {[
                        'Unlimited chatbots',
                        'Custom message limits',
                        'Priority support',
                        'Custom integrations',
                        'Dedicated account manager',
                      ].map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2.5 text-sm text-muted-foreground"
                        >
                          <svg
                            className="h-4 w-4 shrink-0 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!plan.features && plan.type !== 'ENTERPRISE' && (
                    <div className="mb-8 flex-1" />
                  )}

                  {plan.type === 'ENTERPRISE' ? (
                    <a
                      href={cta.href}
                      className="mt-auto flex h-11 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {cta.label}
                    </a>
                  ) : (
                    <Link
                      href={cta.href}
                      className={`mt-auto flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        isRecommended
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                          : plan.type === 'FREE'
                          ? 'border border-border text-foreground hover:bg-accent'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {cta.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No plans fallback */}
        {!isLoading && plans.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="mb-2 text-base font-medium text-foreground">
              Plans coming soon
            </p>
            <p className="text-sm text-muted-foreground">
              We are finalizing our pricing. Check back shortly.
            </p>
          </div>
        )}
      </div>

      {/* Feature Comparison Table */}
      {!isLoading && plans.length > 0 && plans.some((p) => p.features) && (
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Compare all features
            </h2>
            <p className="mt-2 text-muted-foreground">
              See exactly what you get with each plan.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`px-6 py-4 text-center text-sm font-semibold ${
                          plan.type === 'PREMIUM'
                            ? 'text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    'chatbots',
                    'messagesPerMonth',
                    'crawlPages',
                    'fileUploads',
                    'qnaPairs',
                  ].map((featureKey) => (
                    <tr key={featureKey} className="hover:bg-muted/20">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {featureLabel(featureKey)}
                      </td>
                      {plans.map((plan) => {
                        const value = plan.features
                          ? (plan.features as Record<string, number>)[featureKey]
                          : null;
                        return (
                          <td
                            key={plan.id}
                            className="px-6 py-4 text-center text-sm text-muted-foreground"
                          >
                            {plan.type === 'ENTERPRISE'
                              ? 'Custom'
                              : value != null
                              ? formatFeatureValue(value)
                              : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CTA Footer */}
      <div className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="mb-3 text-2xl font-bold text-foreground">
            Ready to get started?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Create your first AI chatbot in minutes. No credit card required for the free plan.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Get Started Free
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CoBuild. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Row Component
// ---------------------------------------------------------------------------

function PricingFeatureRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <svg
        className="h-4 w-4 shrink-0 text-green-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      <span>
        {value === -1 ? 'Unlimited' : value.toLocaleString()} {label}
      </span>
    </li>
  );
}
