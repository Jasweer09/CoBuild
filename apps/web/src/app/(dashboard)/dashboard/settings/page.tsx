'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Branding {
  logoUrl: string | null;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    customCss: string;
  } | null;
}

interface CustomDomain {
  id: string;
  fullDomain: string;
  status: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED';
  cnameTarget: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

interface EmailDomain {
  id: string;
  domain: string;
  dkimTokens: string[];
  isVerified: boolean;
  createdAt: string;
}

type SettingsTab = 'branding' | 'domains' | 'email-domains';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function domainStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'VERIFYING':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'FAILED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('branding');

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'branding', label: 'Branding' },
    { key: 'domains', label: 'Custom Domains' },
    { key: 'email-domains', label: 'Email Domains' },
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
          <span className="text-foreground">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage branding, custom domains, and email configuration.
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
        {tab === 'branding' && <BrandingTab />}
        {tab === 'domains' && <CustomDomainsTab />}
        {tab === 'email-domains' && <EmailDomainsTab />}
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 1: Branding
// ===========================================================================

function BrandingColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div
          className="h-10 w-10 shrink-0 rounded-lg border border-input"
          style={{ backgroundColor: value }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>
    </div>
  );
}

function BrandingTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['deployment', 'branding'],
    queryFn: () =>
      api.get<{ branding: Branding }>('/deployment/branding'),
  });

  const branding = data?.data?.branding;

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [customCss, setCustomCss] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (branding && !initialized) {
      setLogoUrl(branding.logoUrl ?? '');
      if (branding.branding) {
        setPrimaryColor(branding.branding.primaryColor || '#6366f1');
        setSecondaryColor(branding.branding.secondaryColor || '#8b5cf6');
        setFontFamily(branding.branding.fontFamily || 'Inter');
        setCustomCss(branding.branding.customCss || '');
      }
      setInitialized(true);
    }
  }, [branding, initialized]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch('/deployment/branding', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', 'branding'] });
      toast.success('Branding saved');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to save branding',
      );
    },
  });

  function handleSave() {
    saveMutation.mutate({
      logoUrl: logoUrl || null,
      primaryColor,
      secondaryColor,
      fontFamily,
      customCss,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  const fontFamilies = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'system-ui', label: 'System Default' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              Brand Identity
            </h3>
            <div className="space-y-4">
              {/* Logo URL */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Logo URL
                </label>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter a URL to your logo image. File upload coming soon.
                </p>
              </div>

              <BrandingColorInput
                label="Primary Color"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <BrandingColorInput
                label="Secondary Color"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />

              {/* Font Family */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Font Family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                >
                  {fontFamilies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom CSS */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Custom CSS
                </label>
                <textarea
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  placeholder={`/* Custom styles */\n.widget-container {\n  /* your styles */\n}`}
                  rows={10}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none ring-ring focus:ring-2"
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              Live Preview
            </h3>
            <div
              className="overflow-hidden rounded-xl border border-border"
              style={{ fontFamily: fontFamily }}
            >
              {/* Preview Header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: primaryColor }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-8 w-8 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20 text-xs font-bold text-white">
                    Co
                  </div>
                )}
                <span className="text-sm font-semibold text-white">
                  Your Brand
                </span>
              </div>

              {/* Preview Body */}
              <div className="bg-white p-4 dark:bg-gray-900">
                <div className="space-y-3">
                  <div
                    className="inline-block rounded-lg px-3 py-2 text-xs text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Welcome to our platform!
                  </div>
                  <div
                    className="inline-block rounded-lg px-3 py-2 text-xs text-white"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Secondary accent color
                  </div>
                </div>
              </div>

              {/* Preview Footer */}
              <div className="border-t border-border bg-gray-50 px-4 py-2 dark:bg-gray-800">
                <p className="text-xs text-muted-foreground">
                  Font: {fontFamily}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 2: Custom Domains
// ===========================================================================

function CustomDomainsTab() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deployment', 'domains'],
    queryFn: () =>
      api.get<{ domains: CustomDomain[] }>('/deployment/domains'),
  });

  const domains = data?.data?.domains ?? [];

  const addMutation = useMutation({
    mutationFn: (fullDomain: string) =>
      api.post<{ domain: CustomDomain }>('/deployment/domains', { fullDomain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', 'domains'] });
      setShowAddDialog(false);
      setNewDomain('');
      toast.success('Domain added');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to add domain',
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ domain: CustomDomain }>(`/deployment/domains/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', 'domains'] });
      toast.success('Domain verification initiated');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Verification failed',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deployment/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', 'domains'] });
      setDeleteId(null);
      toast.success('Domain removed');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to delete domain',
      );
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* DNS Instructions */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
        <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
          DNS Configuration
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Add a CNAME record pointing your domain to the target shown below.
          DNS changes can take up to 48 hours to propagate. Once configured,
          click &quot;Verify&quot; to check the status.
        </p>
      </div>

      {/* Add Domain button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Domain
        </button>
      </div>

      {/* Domains table */}
      {domains.length === 0 ? (
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
              d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558"
            />
          </svg>
          <p className="mb-1 text-sm font-medium text-foreground">
            No custom domains
          </p>
          <p className="text-xs text-muted-foreground">
            Add a custom domain to serve your chatbots on your own domain.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  CNAME Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Added
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {domains.map((domain) => (
                <tr key={domain.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {domain.fullDomain}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${domainStatusColor(
                        domain.status,
                      )}`}
                    >
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {domain.cnameTarget ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {domain.cnameTarget}
                      </code>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(domain.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(domain.status === 'PENDING' ||
                        domain.status === 'VERIFYING') && (
                        <button
                          type="button"
                          onClick={() => verifyMutation.mutate(domain.id)}
                          disabled={verifyMutation.isPending}
                          className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteId(domain.id)}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Domain Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Add Custom Domain
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the full domain you want to use (e.g., chat.yourdomain.com).
            </p>
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="chat.yourdomain.com"
              className="mb-4 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDomain.trim()) {
                  addMutation.mutate(newDomain.trim());
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewDomain('');
                }}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newDomain.trim()) {
                    addMutation.mutate(newDomain.trim());
                  }
                }}
                disabled={!newDomain.trim() || addMutation.isPending}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Delete Domain
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to remove this custom domain? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="h-10 rounded-lg bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 3: Email Domains
// ===========================================================================

function EmailDomainsTab() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deployment', 'email-domains'],
    queryFn: () =>
      api.get<{ emailDomains: EmailDomain[] }>('/deployment/email-domains'),
  });

  const emailDomains = data?.data?.emailDomains ?? [];

  const addMutation = useMutation({
    mutationFn: (domain: string) =>
      api.post<{ emailDomain: EmailDomain }>('/deployment/email-domains', {
        domain,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['deployment', 'email-domains'],
      });
      setShowAddDialog(false);
      setNewDomain('');
      toast.success('Email domain added');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to add email domain',
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/deployment/email-domains/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['deployment', 'email-domains'],
      });
      toast.success('Email domain verification initiated');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Verification failed',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/deployment/email-domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['deployment', 'email-domains'],
      });
      setDeleteId(null);
      toast.success('Email domain removed');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to delete email domain',
      );
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup Instructions */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
        <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
          Email Domain Setup
        </h4>
        <p className="mb-2 text-sm text-blue-700 dark:text-blue-400">
          To send emails from your own domain, you need to verify domain
          ownership by adding DKIM records to your DNS configuration.
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-700 dark:text-blue-400">
          <li>Add your domain below</li>
          <li>
            Copy the DKIM tokens and create CNAME records in your DNS provider
          </li>
          <li>
            Click &quot;Verify&quot; once DNS records are in place (may take up to 72
            hours to propagate)
          </li>
        </ol>
      </div>

      {/* Add Email Domain button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Email Domain
        </button>
      </div>

      {/* Email Domains table */}
      {emailDomains.length === 0 ? (
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
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
          <p className="mb-1 text-sm font-medium text-foreground">
            No email domains
          </p>
          <p className="text-xs text-muted-foreground">
            Add an email domain to send notifications from your own domain.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emailDomains.map((ed) => (
            <div
              key={ed.id}
              className="rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {ed.domain}
                  </span>
                  {ed.isVerified ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {ed.dkimTokens.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expandedId === ed.id ? null : ed.id)
                      }
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {expandedId === ed.id
                        ? 'Hide DKIM Tokens'
                        : 'Show DKIM Tokens'}
                    </button>
                  )}
                  {!ed.isVerified && (
                    <button
                      type="button"
                      onClick={() => verifyMutation.mutate(ed.id)}
                      disabled={verifyMutation.isPending}
                      className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                    >
                      Verify
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteId(ed.id)}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded DKIM Tokens */}
              {expandedId === ed.id && ed.dkimTokens.length > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Add these CNAME records to your DNS:
                  </p>
                  <div className="space-y-2">
                    {ed.dkimTokens.map((token, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Name:
                          </p>
                          <code className="block break-all text-xs text-foreground">
                            {token}._domainkey.{ed.domain}
                          </code>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Value:
                          </p>
                          <code className="block break-all text-xs text-foreground">
                            {token}.dkim.amazonses.com
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${token}._domainkey.${ed.domain}`,
                            );
                            toast.success('DKIM token name copied');
                          }}
                          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Email Domain Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Add Email Domain
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter the domain you want to send emails from (e.g.,
              yourdomain.com).
            </p>
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="yourdomain.com"
              className="mb-4 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDomain.trim()) {
                  addMutation.mutate(newDomain.trim());
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewDomain('');
                }}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newDomain.trim()) {
                    addMutation.mutate(newDomain.trim());
                  }
                }}
                disabled={!newDomain.trim() || addMutation.isPending}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              Delete Email Domain
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to remove this email domain? You will no
              longer be able to send emails from this domain.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="h-10 rounded-lg bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
