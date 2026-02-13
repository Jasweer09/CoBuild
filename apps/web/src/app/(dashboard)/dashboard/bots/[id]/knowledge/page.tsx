'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CrawlJob {
  id: string;
  url: string;
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  maxDepth: number;
  confirmedLimit: number;
  pagesFound: number;
  pagesCrawled: number;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

interface CrawlPage {
  id: string;
  url: string;
  title: string;
  status: string;
  pageType: string;
  contentLength: number;
  createdAt: string;
}

interface QnaPair {
  id: string;
  question: string;
  answer: string;
  trainingStatus: 'PENDING' | 'PROCESSING' | 'TRAINED' | 'FAILED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TextTraining {
  id: string;
  content: string;
  trainingStatus: 'PENDING' | 'PROCESSING' | 'TRAINED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface CrawlJobsResponse extends PaginationMeta {
  jobs: CrawlJob[];
}

interface CrawlPagesResponse extends PaginationMeta {
  pages: CrawlPage[];
}

interface QnaPairsResponse extends PaginationMeta {
  qnaPairs: QnaPair[];
}

type KnowledgeTab = 'web-sources' | 'qna' | 'text' | 'files';

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'TRAINED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'PROCESSING':
    case 'QUEUED':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'FAILED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  const { id: chatbotId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<KnowledgeTab>('web-sources');

  // Fetch chatbot info for breadcrumb
  const { data: botData } = useQuery({
    queryKey: ['chatbot', chatbotId],
    queryFn: () => api.get<{ chatbot: { id: string; name: string } }>(`/chatbot/${chatbotId}`),
  });

  const bot = botData?.data?.chatbot;

  const tabs: { key: KnowledgeTab; label: string }[] = [
    { key: 'web-sources', label: 'Web Sources' },
    { key: 'qna', label: 'Q&A Pairs' },
    { key: 'text', label: 'Text Training' },
    { key: 'files', label: 'Files' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/bots" className="hover:text-foreground">
            Chatbots
          </Link>
          <span>/</span>
          <Link href={`/dashboard/bots/${chatbotId}`} className="hover:text-foreground">
            {bot?.name ?? 'Chatbot'}
          </Link>
          <span>/</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <Link
            href={`/dashboard/bots/${chatbotId}`}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to Settings
          </Link>
        </div>
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
        {tab === 'web-sources' && <WebSourcesTab chatbotId={chatbotId} />}
        {tab === 'qna' && <QnaTab chatbotId={chatbotId} />}
        {tab === 'text' && <TextTrainingTab chatbotId={chatbotId} />}
        {tab === 'files' && <FilesTab />}
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 1: Web Sources (Crawl Jobs)
// ===========================================================================

function WebSourcesTab({ chatbotId }: { chatbotId: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectingJobId, setSelectingJobId] = useState<string | null>(null);

  // Crawl form state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(-1);
  const [pageLimit, setPageLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ['crawlJobs', chatbotId, page],
    queryFn: () =>
      api.get<CrawlJobsResponse>(
        `/knowledge/crawl/${chatbotId}?page=${page}&limit=10`,
      ),
  });

  const startCrawlMutation = useMutation({
    mutationFn: (body: { chatbotId: string; url: string; maxDepth: number; confirmedLimit: number }) =>
      api.post('/knowledge/crawl', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawlJobs', chatbotId] });
      setShowAddDialog(false);
      setCrawlUrl('');
      setMaxDepth(-1);
      setPageLimit(50);
      toast.success('Crawl job started');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to start crawl');
    },
  });

  const cancelCrawlMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/knowledge/crawl/job/${jobId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawlJobs', chatbotId] });
      toast.success('Crawl job cancelled');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to cancel');
    },
  });

  function handleStartCrawl(e: React.FormEvent) {
    e.preventDefault();
    if (!crawlUrl.trim()) return;
    startCrawlMutation.mutate({
      chatbotId,
      url: crawlUrl.trim(),
      maxDepth,
      confirmedLimit: pageLimit,
    });
  }

  const jobs = data?.data?.jobs ?? [];
  const pagination = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Web Sources</h2>
          <p className="text-sm text-muted-foreground">
            Crawl websites to train your chatbot with web content.
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Add URL
        </button>
      </div>

      {/* Add URL dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Add Web Source</h3>
            <form onSubmit={handleStartCrawl} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  URL
                </label>
                <input
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Max Depth
                  </label>
                  <select
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                  >
                    <option value={-1}>Unlimited</option>
                    <option value={0}>0 (Single page)</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    How deep to follow links from the starting URL.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Page Limit
                  </label>
                  <input
                    type="number"
                    value={pageLimit}
                    onChange={(e) => setPageLimit(parseInt(e.target.value) || 1)}
                    min={1}
                    max={500}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Maximum number of pages to crawl.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDialog(false);
                    setCrawlUrl('');
                  }}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startCrawlMutation.isPending}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {startCrawlMutation.isPending ? 'Starting...' : 'Start Crawl'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <svg className="mb-3 h-10 w-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <p className="mb-1 text-sm font-medium text-foreground">No web sources yet</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Add a URL to start crawling web content for training.
          </p>
          <button
            onClick={() => setShowAddDialog(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add URL
          </button>
        </div>
      )}

      {/* Crawl jobs table */}
      {!isLoading && jobs.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Pages</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <CrawlJobRow
                  key={job.id}
                  job={job}
                  isExpanded={expandedJobId === job.id}
                  onToggleExpand={() =>
                    setExpandedJobId(expandedJobId === job.id ? null : job.id)
                  }
                  isSelecting={selectingJobId === job.id}
                  onStartSelecting={() => setSelectingJobId(job.id)}
                  onStopSelecting={() => setSelectingJobId(null)}
                  onCancel={() => cancelCrawlMutation.mutate(job.id)}
                  chatbotId={chatbotId}
                />
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalDocs} total)
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crawl Job Row (expandable)
// ---------------------------------------------------------------------------

function CrawlJobRow({
  job,
  isExpanded,
  onToggleExpand,
  isSelecting,
  onStartSelecting,
  onStopSelecting,
  onCancel,
  chatbotId,
}: {
  job: CrawlJob;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelecting: boolean;
  onStartSelecting: () => void;
  onStopSelecting: () => void;
  onCancel: () => void;
  chatbotId: string;
}) {
  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
            <span className="max-w-xs truncate text-sm font-medium text-foreground">
              {job.url}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(job.status)}`}>
            {job.status}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {job.pagesCrawled} / {job.pagesFound || job.confirmedLimit}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {formatDate(job.createdAt)}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {(job.status === 'PENDING' || job.status === 'QUEUED' || job.status === 'PROCESSING') && (
              <button
                onClick={onCancel}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Cancel
              </button>
            )}
            {job.status === 'COMPLETED' && (
              <button
                onClick={onStartSelecting}
                className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              >
                Select Pages
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded: show crawled pages */}
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-muted/30 px-4 py-4">
            <CrawledPagesList
              jobId={job.id}
              isSelecting={isSelecting}
              onStopSelecting={onStopSelecting}
              chatbotId={chatbotId}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Crawled Pages List (within expanded job row)
// ---------------------------------------------------------------------------

function CrawledPagesList({
  jobId,
  isSelecting,
  onStopSelecting,
  chatbotId,
}: {
  jobId: string;
  isSelecting: boolean;
  onStopSelecting: () => void;
  chatbotId: string;
}) {
  const queryClient = useQueryClient();
  const [pagesPage, setPagesPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch crawled pages
  const { data, isLoading } = useQuery({
    queryKey: ['crawlPages', jobId, pagesPage],
    queryFn: () =>
      api.get<CrawlPagesResponse>(
        `/knowledge/crawl/job/${jobId}/pages?page=${pagesPage}&limit=20`,
      ),
  });

  // Fetch pending pages when selecting
  const { data: pendingData } = useQuery({
    queryKey: ['pendingPages', jobId],
    queryFn: () =>
      api.get<{ pages: CrawlPage[] }>(`/knowledge/crawl/job/${jobId}/pending`),
    enabled: isSelecting,
  });

  const selectPagesMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.post(`/knowledge/crawl/job/${jobId}/select`, { selectedPageIds: ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawlPages', jobId] });
      queryClient.invalidateQueries({ queryKey: ['pendingPages', jobId] });
      queryClient.invalidateQueries({ queryKey: ['crawlJobs', chatbotId] });
      setSelectedIds(new Set());
      onStopSelecting();
      toast.success('Pages selected for training');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to select pages');
    },
  });

  const pages = data?.data?.pages ?? [];
  const pagination = data?.data;
  const pendingPages = pendingData?.data?.pages ?? [];
  const displayPages = isSelecting ? pendingPages : pages;

  const toggleSelect = useCallback(
    (pageId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(pageId)) {
          next.delete(pageId);
        } else {
          next.add(pageId);
        }
        return next;
      });
    },
    [],
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displayPages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayPages.map((p) => p.id)));
    }
  }, [selectedIds.size, displayPages]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (displayPages.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {isSelecting ? 'No pending pages available for selection.' : 'No pages crawled yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selection controls */}
      {isSelecting && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selectedIds.size === displayPages.length && displayPages.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-input"
              />
              Select All ({selectedIds.size} / {displayPages.length})
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onStopSelecting}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={() => selectPagesMutation.mutate(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || selectPagesMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {selectPagesMutation.isPending
                ? 'Training...'
                : `Train Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Pages list */}
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {isSelecting && (
                <th className="w-10 px-3 py-2" />
              )}
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Page</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayPages.map((crawlPage) => (
              <tr key={crawlPage.id} className="hover:bg-muted/30">
                {isSelecting && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(crawlPage.id)}
                      onChange={() => toggleSelect(crawlPage.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <p className="max-w-sm truncate text-sm font-medium text-foreground">
                    {crawlPage.title || crawlPage.url}
                  </p>
                  <p className="max-w-sm truncate text-xs text-muted-foreground">
                    {crawlPage.url}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(crawlPage.status)}`}>
                    {crawlPage.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {crawlPage.pageType || 'HTML'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {crawlPage.contentLength
                    ? `${(crawlPage.contentLength / 1024).toFixed(1)} KB`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pages pagination (only in non-selecting mode) */}
      {!isSelecting && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagesPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevPage}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPagesPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 2: Q&A Pairs
// ===========================================================================

function QnaTab({ chatbotId }: { chatbotId: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingQna, setEditingQna] = useState<QnaPair | null>(null);

  // Add Q&A form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // Bulk add state
  const [bulkText, setBulkText] = useState('');

  // Edit form state
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['qnaPairs', chatbotId, page, debouncedSearch],
    queryFn: () =>
      api.get<QnaPairsResponse>(
        `/knowledge/qna/${chatbotId}?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`,
      ),
  });

  const createQnaMutation = useMutation({
    mutationFn: (body: { chatbotId: string; question: string; answer: string }) =>
      api.post('/knowledge/qna', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qnaPairs', chatbotId] });
      queryClient.invalidateQueries({ queryKey: ['chatbot', chatbotId] });
      setShowAddDialog(false);
      setNewQuestion('');
      setNewAnswer('');
      toast.success('Q&A pair created');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create Q&A');
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (pairs: { question: string; answer: string }[]) =>
      api.post('/knowledge/qna/bulk', { chatbotId, pairs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qnaPairs', chatbotId] });
      queryClient.invalidateQueries({ queryKey: ['chatbot', chatbotId] });
      setShowBulkDialog(false);
      setBulkText('');
      toast.success('Q&A pairs created');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create Q&A pairs');
    },
  });

  const updateQnaMutation = useMutation({
    mutationFn: ({ qnaId, ...body }: { qnaId: string; question?: string; answer?: string; isActive?: boolean }) =>
      api.patch(`/knowledge/qna/${qnaId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qnaPairs', chatbotId] });
      setEditingQna(null);
      toast.success('Q&A pair updated');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update Q&A');
    },
  });

  const deleteQnaMutation = useMutation({
    mutationFn: (qnaId: string) => api.delete(`/knowledge/qna/${qnaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qnaPairs', chatbotId] });
      queryClient.invalidateQueries({ queryKey: ['chatbot', chatbotId] });
      toast.success('Q&A pair deleted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete Q&A');
    },
  });

  function handleCreateQna(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    createQnaMutation.mutate({
      chatbotId,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
    });
  }

  function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkText.trim().split('\n').filter((l) => l.includes('|'));
    const pairs = lines.map((line) => {
      const [question, ...rest] = line.split('|');
      return {
        question: question.trim(),
        answer: rest.join('|').trim(),
      };
    }).filter((p) => p.question && p.answer);

    if (pairs.length === 0) {
      toast.error('No valid Q&A pairs found. Use format: Question | Answer');
      return;
    }
    bulkCreateMutation.mutate(pairs);
  }

  function handleUpdateQna(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQna) return;
    updateQnaMutation.mutate({
      qnaId: editingQna.id,
      question: editQuestion.trim(),
      answer: editAnswer.trim(),
    });
  }

  function openEditDialog(qna: QnaPair) {
    setEditingQna(qna);
    setEditQuestion(qna.question);
    setEditAnswer(qna.answer);
  }

  const qnaPairs = data?.data?.qnaPairs ?? [];
  const pagination = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Q&A Pairs</h2>
          <p className="text-sm text-muted-foreground">
            Add question and answer pairs to train your chatbot.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkDialog(true)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Bulk Add
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add Q&A
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search Q&A pairs..."
          className="h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>

      {/* Add Q&A dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Add Q&A Pair</h3>
            <form onSubmit={handleCreateQna} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Question
                </label>
                <input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What is your return policy?"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Answer
                </label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Our return policy allows returns within 30 days..."
                  required
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewQuestion('');
                    setNewAnswer('');
                  }}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createQnaMutation.isPending}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createQnaMutation.isPending ? 'Creating...' : 'Create Q&A'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add dialog */}
      {showBulkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Bulk Add Q&A Pairs</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter one Q&A pair per line, using a pipe (|) to separate question and answer.
            </p>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`What is your return policy? | We accept returns within 30 days.\nDo you offer free shipping? | Yes, on orders over $50.\nWhat are your business hours? | We're open Monday-Friday, 9am-5pm.`}
                  rows={8}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 font-mono"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {bulkText.trim().split('\n').filter((l) => l.includes('|')).length} valid
                  pair(s) detected
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkDialog(false);
                    setBulkText('');
                  }}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkCreateMutation.isPending}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {bulkCreateMutation.isPending ? 'Creating...' : 'Create All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Q&A dialog */}
      {editingQna && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Edit Q&A Pair</h3>
            <form onSubmit={handleUpdateQna} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Question
                </label>
                <input
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Answer
                </label>
                <textarea
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingQna(null)}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateQnaMutation.isPending}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateQnaMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && qnaPairs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <svg className="mb-3 h-10 w-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          <p className="mb-1 text-sm font-medium text-foreground">
            {debouncedSearch ? 'No Q&A pairs match your search' : 'No Q&A pairs yet'}
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            {debouncedSearch
              ? 'Try a different search term.'
              : 'Add question and answer pairs to improve your chatbot.'}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Add Q&A
            </button>
          )}
        </div>
      )}

      {/* Q&A table */}
      {!isLoading && qnaPairs.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Question</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Answer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {qnaPairs.map((qna) => (
                <tr key={qna.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="max-w-xs truncate text-sm font-medium text-foreground">
                      {qna.question}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-xs truncate text-sm text-muted-foreground">
                      {qna.answer}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(qna.trainingStatus)}`}>
                      {qna.trainingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() =>
                        updateQnaMutation.mutate({
                          qnaId: qna.id,
                          isActive: !qna.isActive,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        qna.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                      title={qna.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          qna.isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditDialog(qna)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this Q&A pair?')) {
                            deleteQnaMutation.mutate(qna.id);
                          }
                        }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
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
                Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalDocs} total)
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
      )}
    </div>
  );
}

// ===========================================================================
// Tab 3: Text Training
// ===========================================================================

function TextTrainingTab({ chatbotId }: { chatbotId: string }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['textTraining', chatbotId],
    queryFn: () =>
      api.get<{ textTraining: TextTraining | null }>(`/knowledge/text/${chatbotId}`),
  });

  const textTraining = data?.data?.textTraining;

  // Initialize content from server data
  if (textTraining && !isInitialized) {
    setContent(textTraining.content);
    setIsInitialized(true);
  } else if (!textTraining && !isInitialized && !isLoading) {
    setIsInitialized(true);
  }

  const upsertMutation = useMutation({
    mutationFn: (body: { chatbotId: string; content: string }) =>
      api.post('/knowledge/text', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textTraining', chatbotId] });
      toast.success('Text training content saved');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save text');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/knowledge/text/${chatbotId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textTraining', chatbotId] });
      setContent('');
      setIsInitialized(true);
      setShowDeleteConfirm(false);
      toast.success('Text training content deleted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete text');
    },
  });

  function handleSave() {
    if (!content.trim()) {
      toast.error('Please enter some training text');
      return;
    }
    upsertMutation.mutate({ chatbotId, content: content.trim() });
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Text Training</h2>
          <p className="text-sm text-muted-foreground">
            Provide custom text content to train your chatbot.
          </p>
        </div>
        {textTraining && (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(textTraining.trainingStatus)}`}>
            {textTraining.trainingStatus}
          </span>
        )}
      </div>

      {/* Text content area */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Training Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your training text here. This can include company information, product details, FAQs, policies, or any other content you want your chatbot to know about.&#10;&#10;For best results, write in a clear and structured format. You can use paragraphs, bullet points, or any natural text format."
            rows={16}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2 font-mono"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {content.length.toLocaleString()} characters
            </p>
            {textTraining?.updatedAt && (
              <p className="text-xs text-muted-foreground">
                Last saved: {formatDate(textTraining.updatedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={upsertMutation.isPending || !content.trim()}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {upsertMutation.isPending ? 'Saving...' : 'Save & Train'}
          </button>
          {textTraining && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="h-10 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Content'}
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-foreground">Delete Text Training</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Are you sure you want to delete all text training content? This action cannot be
              undone and the chatbot will no longer use this text for responses.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
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
// Tab 4: Files (Placeholder)
// ===========================================================================

function FilesTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">File Upload</h2>
        <p className="text-sm text-muted-foreground">
          Upload documents to train your chatbot with file content.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 py-20">
        <svg className="mb-4 h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="mb-2 text-base font-medium text-foreground">Coming Soon</p>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          File upload training is coming in a future update. You will be able to upload PDF, DOCX,
          TXT, and other document formats to train your chatbot.
        </p>
        <button
          disabled
          className="mt-6 h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50 cursor-not-allowed"
        >
          Upload Files
        </button>
      </div>
    </div>
  );
}
