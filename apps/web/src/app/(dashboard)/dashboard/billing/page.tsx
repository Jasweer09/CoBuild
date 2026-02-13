'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

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

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'PAUSED';
  billingPeriod: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  plan: Plan;
}

interface CreditTransaction {
  id: string;
  amount: number;
  type: 'PURCHASE' | 'USAGE' | 'REFUND' | 'BONUS' | 'EXPIRY' | 'ADDON';
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface FeatureUsage {
  id: string;
  featureName: string;
  used: number;
  limit: number;
}

interface Invoice {
  id: string;
  amount: string;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

interface PaginationMeta {
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface TransactionsResponse extends PaginationMeta {
  transactions: CreditTransaction[];
}

interface InvoicesResponse extends PaginationMeta {
  invoices: Invoice[];
}

type BillingTab = 'subscription' | 'plans' | 'credits' | 'invoices';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: string | number, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

function subscriptionStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'TRIALING':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'PAST_DUE':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'CANCELED':
    case 'PAUSED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function invoiceStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'open':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'void':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    case 'uncollectible':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function creditTypeColor(type: string): string {
  switch (type) {
    case 'PURCHASE':
    case 'BONUS':
    case 'ADDON':
      return 'text-green-600 dark:text-green-400';
    case 'USAGE':
    case 'EXPIRY':
      return 'text-red-600 dark:text-red-400';
    case 'REFUND':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-foreground';
  }
}

function usageProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function usageProgressTrack(percentage: number): string {
  if (percentage >= 90) return 'bg-red-100 dark:bg-red-900/20';
  if (percentage >= 70) return 'bg-yellow-100 dark:bg-yellow-900/20';
  return 'bg-green-100 dark:bg-green-900/20';
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const [tab, setTab] = useState<BillingTab>('subscription');

  const tabs: { key: BillingTab; label: string }[] = [
    { key: 'subscription', label: 'Subscription' },
    { key: 'plans', label: 'Plans & Pricing' },
    { key: 'credits', label: 'Credits & Usage' },
    { key: 'invoices', label: 'Invoices' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground">Billing</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription, view plans, and track usage.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'subscription' && <SubscriptionTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'credits' && <CreditsTab />}
        {tab === 'invoices' && <InvoicesTab />}
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 1: Subscription
// ===========================================================================

function SubscriptionTab() {
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () =>
      api.get<{ subscription: Subscription | null }>('/billing/subscription'),
  });

  const portalMutation = useMutation({
    mutationFn: () => api.post<{ url: string }>('/billing/portal'),
    onSuccess: (res) => {
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to open billing portal');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post('/billing/subscription/cancel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      setShowCancelConfirm(false);
      toast.success('Subscription cancellation scheduled');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to cancel subscription');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => api.post('/billing/subscription/reactivate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast.success('Subscription reactivated');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reactivate subscription');
    },
  });

  const subscription = data?.data?.subscription;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  // No subscription / free plan
  if (!subscription || subscription.plan.type === 'FREE') {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Current Plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You are currently on the Free plan.
              </p>
            </div>
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
              FREE
            </span>
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              />
            </svg>
            <p className="mb-2 text-base font-medium text-foreground">
              Upgrade to unlock more features
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Get more chatbots, messages, and advanced features with a paid plan.
            </p>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active subscription
  return (
    <div className="space-y-6">
      {/* Subscription overview card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Current Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your subscription details and management options.
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${subscriptionStatusColor(
              subscription.status,
            )}`}
          >
            {subscription.status}
          </span>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Plan
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {subscription.plan.name}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Billing Period
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {subscription.billingPeriod === 'MONTHLY' ? 'Monthly' : 'Yearly'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Price
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {subscription.billingPeriod === 'MONTHLY'
                ? formatCurrency(subscription.plan.priceMonthly)
                : formatCurrency(subscription.plan.priceYearly)}
              <span className="text-sm font-normal text-muted-foreground">
                /{subscription.billingPeriod === 'MONTHLY' ? 'mo' : 'yr'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {subscription.cancelAt ? 'Cancels On' : 'Next Billing Date'}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {subscription.cancelAt
                ? formatDate(subscription.cancelAt)
                : formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>
        </div>

        {/* Trial info */}
        {subscription.status === 'TRIALING' && subscription.trialEnd && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-900/10">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Your free trial ends on {formatDate(subscription.trialEnd)}. You will be charged
              automatically after the trial period.
            </p>
          </div>
        )}

        {/* Cancel at info */}
        {subscription.cancelAt && subscription.status !== 'CANCELED' && (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Your subscription is scheduled to cancel on {formatDate(subscription.cancelAt)}.
              You will retain access until then.
            </p>
          </div>
        )}

        {/* Past due info */}
        {subscription.status === 'PAST_DUE' && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-400">
              Your payment is past due. Please update your payment method to avoid service
              interruption.
            </p>
          </div>
        )}
      </div>

      {/* Actions card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Manage Subscription
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {portalMutation.isPending ? 'Opening...' : 'Manage Subscription'}
          </button>

          {subscription.cancelAt && subscription.status !== 'CANCELED' ? (
            <button
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              className="h-10 rounded-lg border border-green-300 px-4 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-900/40 dark:text-green-400 dark:hover:bg-green-900/20 disabled:opacity-50"
            >
              {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
            </button>
          ) : (
            subscription.status !== 'CANCELED' && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="h-10 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
              >
                Cancel Subscription
              </button>
            )
          )}
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Cancel Subscription
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to cancel your subscription? You will retain access to your
              current plan features until the end of the billing period.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="h-10 rounded-lg bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 2: Plans & Pricing
// ===========================================================================

function PlansTab() {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<{ plans: Plan[] }>('/billing/plans'),
  });

  const { data: subData } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () =>
      api.get<{ subscription: Subscription | null }>('/billing/subscription'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (body: { planId: string; billingPeriod: 'MONTHLY' | 'YEARLY' }) =>
      api.post<{ url: string }>('/billing/checkout', body),
    onSuccess: (res) => {
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to start checkout');
    },
  });

  const plans = (plansData?.data?.plans ?? [])
    .filter((p) => p.isActive && p.type !== 'ADD_ON')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const subscription = subData?.data?.subscription;
  const currentPlanId = subscription?.plan?.id;

  function getButtonConfig(plan: Plan) {
    if (plan.id === currentPlanId) {
      return { label: 'Current Plan', disabled: true, variant: 'current' as const };
    }
    if (plan.type === 'FREE') {
      return { label: 'Free Plan', disabled: true, variant: 'outline' as const };
    }
    if (plan.type === 'ENTERPRISE') {
      return { label: 'Contact Sales', disabled: false, variant: 'outline' as const };
    }

    const currentSortOrder = subscription?.plan?.sortOrder ?? 0;
    if (plan.sortOrder > currentSortOrder) {
      return { label: 'Upgrade', disabled: false, variant: 'primary' as const };
    }
    return { label: 'Downgrade', disabled: false, variant: 'outline' as const };
  }

  function handlePlanAction(plan: Plan) {
    if (plan.type === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@cobuild.ai?subject=Enterprise Plan Inquiry';
      return;
    }
    checkoutMutation.mutate({ planId: plan.id, billingPeriod });
  }

  if (plansLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing period toggle */}
      <div className="flex items-center justify-center gap-3">
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
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            billingPeriod === 'YEARLY' ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
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
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Save 20%
          </span>
        )}
      </div>

      {/* Plan cards */}
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="mb-1 text-sm font-medium text-foreground">No plans available</p>
          <p className="text-xs text-muted-foreground">
            Plans will be available soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => {
            const btn = getButtonConfig(plan);
            const price =
              billingPeriod === 'MONTHLY'
                ? plan.priceMonthly
                : plan.priceYearly;
            const isRecommended = plan.type === 'PREMIUM';
            const isCurrent = plan.id === currentPlanId;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-md ${
                  isRecommended
                    ? 'border-primary bg-card shadow-sm'
                    : isCurrent
                    ? 'border-green-300 bg-card dark:border-green-900/40'
                    : 'border-border bg-card'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  {plan.type === 'FREE' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">$0</span>
                      <span className="text-sm text-muted-foreground">/forever</span>
                    </div>
                  ) : plan.type === 'ENTERPRISE' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{billingPeriod === 'MONTHLY' ? 'mo' : 'yr'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {plan.features && (
                  <ul className="mb-6 flex-1 space-y-2.5">
                    <FeatureRow
                      label="Chatbots"
                      value={plan.features.chatbots}
                    />
                    <FeatureRow
                      label="Messages / month"
                      value={plan.features.messagesPerMonth}
                    />
                    <FeatureRow
                      label="Crawl pages"
                      value={plan.features.crawlPages}
                    />
                    <FeatureRow
                      label="File uploads"
                      value={plan.features.fileUploads}
                    />
                    <FeatureRow
                      label="Q&A pairs"
                      value={plan.features.qnaPairs}
                    />
                  </ul>
                )}

                {!plan.features && <div className="mb-6 flex-1" />}

                <button
                  onClick={() => handlePlanAction(plan)}
                  disabled={btn.disabled || checkoutMutation.isPending}
                  className={`mt-auto h-10 w-full rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    btn.variant === 'primary'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : btn.variant === 'current'
                      ? 'border border-green-300 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-400'
                      : 'border border-border text-foreground hover:bg-accent'
                  }`}
                >
                  {checkoutMutation.isPending &&
                  checkoutMutation.variables?.planId === plan.id
                    ? 'Redirecting...'
                    : btn.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature comparison table */}
      {plans.length > 0 && plans.some((p) => p.features) && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              Feature Comparison
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {['chatbots', 'messagesPerMonth', 'crawlPages', 'fileUploads', 'qnaPairs'].map(
                  (featureKey) => (
                    <tr key={featureKey} className="hover:bg-muted/30">
                      <td className="px-6 py-3 text-sm font-medium text-foreground">
                        {featureLabel(featureKey)}
                      </td>
                      {plans.map((plan) => {
                        const value = plan.features
                          ? (plan.features as Record<string, number>)[featureKey]
                          : null;
                        return (
                          <td
                            key={plan.id}
                            className="px-6 py-3 text-center text-sm text-muted-foreground"
                          >
                            {plan.type === 'ENTERPRISE'
                              ? 'Custom'
                              : value != null
                              ? value === -1
                                ? 'Unlimited'
                                : value.toLocaleString()
                              : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
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

// ===========================================================================
// Tab 3: Credits & Usage
// ===========================================================================

function CreditsTab() {
  const [txPage, setTxPage] = useState(1);

  const { data: creditsData, isLoading: creditsLoading } = useQuery({
    queryKey: ['billing', 'credits'],
    queryFn: () => api.get<{ balance: number }>('/billing/credits'),
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['billing', 'usage'],
    queryFn: () => api.get<{ usage: FeatureUsage[] }>('/billing/usage'),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['billing', 'transactions', txPage],
    queryFn: () =>
      api.get<TransactionsResponse>(
        `/billing/credits/transactions?page=${txPage}&limit=10`,
      ),
  });

  const balance = creditsData?.data?.balance ?? 0;
  const usage = usageData?.data?.usage ?? [];
  const transactions = txData?.data?.transactions ?? [];
  const txPagination = txData?.data;

  return (
    <div className="space-y-6">
      {/* Credit balance */}
      {creditsLoading ? (
        <div className="h-36 animate-pulse rounded-xl border border-border bg-card" />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Credit Balance</p>
              <p className="mt-2 text-4xl font-bold text-foreground">
                {balance.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">credits available</p>
            </div>
            <button
              disabled
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              Buy Credits
            </button>
          </div>
        </div>
      )}

      {/* Usage section */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-foreground">Feature Usage</h3>
        {usageLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : usage.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No usage data available yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usage.map((item) => {
              const percentage = item.limit > 0 ? (item.used / item.limit) * 100 : 0;
              const clampedPercentage = Math.min(percentage, 100);

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {featureLabel(item.featureName)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.used.toLocaleString()} / {item.limit === -1 ? 'Unlimited' : item.limit.toLocaleString()}
                    </p>
                  </div>
                  {item.limit !== -1 && (
                    <div
                      className={`h-2 w-full overflow-hidden rounded-full ${usageProgressTrack(
                        percentage,
                      )}`}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${usageProgressColor(
                          percentage,
                        )}`}
                        style={{ width: `${clampedPercentage}%` }}
                      />
                    </div>
                  )}
                  {item.limit === -1 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-green-100 dark:bg-green-900/20">
                      <div className="h-full w-full rounded-full bg-green-500 opacity-30" />
                    </div>
                  )}
                  {percentage >= 90 && item.limit !== -1 && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {percentage >= 100
                        ? 'Limit reached. Upgrade your plan for more.'
                        : 'Approaching limit. Consider upgrading.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Credit Transaction History
        </h3>

        {txLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="mb-1 text-sm font-medium text-foreground">
              No transactions yet
            </p>
            <p className="text-xs text-muted-foreground">
              Credit transactions will appear here as you use the platform.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === 'USAGE' || tx.type === 'EXPIRY'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : tx.type === 'REFUND'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {tx.description || '-'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-medium ${creditTypeColor(
                        tx.type,
                      )}`}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {txPagination && txPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {txPagination.currentPage} of {txPagination.totalPages} (
                  {txPagination.totalDocs} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                    disabled={!txPagination.hasPrevPage}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setTxPage((p) => p + 1)}
                    disabled={!txPagination.hasNextPage}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 4: Invoices
// ===========================================================================

function InvoicesTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'invoices', page],
    queryFn: () =>
      api.get<InvoicesResponse>(`/billing/invoices?page=${page}&limit=10`),
  });

  const invoices = data?.data?.invoices ?? [];
  const pagination = data?.data;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
        <svg
          className="mb-3 h-10 w-10 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <p className="mb-1 text-sm font-medium text-foreground">No invoices yet</p>
        <p className="text-xs text-muted-foreground">
          Invoices will appear here once you have a paid subscription.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
        <p className="text-sm text-muted-foreground">
          View and download your billing invoices.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Period
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-sm text-foreground">
                  {formatDate(invoice.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {invoice.periodStart && invoice.periodEnd
                    ? `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
                    : '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${invoiceStatusColor(
                      invoice.status,
                    )}`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {invoice.hostedInvoiceUrl && (
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        View
                      </a>
                    )}
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Download PDF
                      </a>
                    )}
                    {!invoice.hostedInvoiceUrl && !invoice.pdfUrl && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.totalPages} (
              {pagination.totalDocs} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
