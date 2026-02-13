'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

interface Chatbot {
  id: string;
  name: string;
  slug: string;
  aiModel: string;
  temperature: number;
  systemPrompt: string | null;
  initialMessage: string | null;
  suggestedMessages: string[];
  status: string;
  isPublic: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  showCitations: boolean;
  rateLimitEnabled: boolean;
  rateLimitMessages: number | null;
  rateLimitWindowMinutes: number | null;
  rateLimitErrorMessage: string | null;
  _count: { conversations: number; qnaPairs: number; crawlJobs: number };
}

type Tab = 'general' | 'ai' | 'appearance' | 'rate-limit';

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');

  const { data, isLoading } = useQuery({
    queryKey: ['chatbot', id],
    queryFn: () => api.get<{ chatbot: Chatbot }>(`/chatbot/${id}`),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/chatbot/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot', id] });
      toast.success('Settings saved');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save');
    },
  });

  const bot = data?.data?.chatbot;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Chatbot not found</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'ai', label: 'AI Settings' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'rate-limit', label: 'Rate Limit' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              href="/dashboard/bots"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Chatbots
            </Link>
            <span className="text-muted-foreground">/</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{bot.name}</h1>
        </div>
        <Link
          href={`/dashboard/bots/${id}/chat`}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Chat
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Conversations</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {bot._count.conversations}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Q&A Pairs</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {bot._count.qnaPairs}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Crawl Jobs</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {bot._count.crawlJobs}
          </p>
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
      <div className="rounded-xl border border-border bg-card p-6">
        {tab === 'general' && (
          <GeneralTab bot={bot} onSave={(d) => updateMutation.mutate(d)} saving={updateMutation.isPending} />
        )}
        {tab === 'ai' && (
          <AiTab bot={bot} onSave={(d) => updateMutation.mutate(d)} saving={updateMutation.isPending} />
        )}
        {tab === 'appearance' && (
          <div className="text-center py-12 text-muted-foreground">
            Appearance settings coming in Phase 5 (White-label & Deployment)
          </div>
        )}
        {tab === 'rate-limit' && (
          <RateLimitTab bot={bot} onSave={(d) => updateMutation.mutate(d)} saving={updateMutation.isPending} />
        )}
      </div>
    </div>
  );
}

function GeneralTab({
  bot,
  onSave,
  saving,
}: {
  bot: Chatbot;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(bot.name);
  const [isPublic, setIsPublic] = useState(bot.isPublic);
  const [initialMessage, setInitialMessage] = useState(bot.initialMessage ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, isPublic, initialMessage: initialMessage || null });
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Initial Message
        </label>
        <input
          value={initialMessage}
          onChange={(e) => setInitialMessage(e.target.value)}
          placeholder="Hello! How can I help you today?"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublic"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="isPublic" className="text-sm text-foreground">
          Public (accessible without authentication)
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}

function AiTab({
  bot,
  onSave,
  saving,
}: {
  bot: Chatbot;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [aiModel, setAiModel] = useState(bot.aiModel);
  const [temperature, setTemperature] = useState(bot.temperature);
  const [systemPrompt, setSystemPrompt] = useState(bot.systemPrompt ?? '');

  const models = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Advanced)' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Backup)' },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          aiModel,
          temperature,
          systemPrompt: systemPrompt || null,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          AI Model
        </label>
        <select
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Temperature: {temperature}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Precise (0)</span>
          <span>Creative (1)</span>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful AI assistant..."
          rows={6}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}

function RateLimitTab({
  bot,
  onSave,
  saving,
}: {
  bot: Chatbot;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [enabled, setEnabled] = useState(bot.rateLimitEnabled);
  const [messages, setMessages] = useState(bot.rateLimitMessages ?? 20);
  const [windowMinutes, setWindowMinutes] = useState(
    bot.rateLimitWindowMinutes ?? 60,
  );
  const [errorMessage, setErrorMessage] = useState(
    bot.rateLimitErrorMessage ?? '',
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          rateLimitEnabled: enabled,
          rateLimitMessages: messages,
          rateLimitWindowMinutes: windowMinutes,
          rateLimitErrorMessage: errorMessage || null,
        });
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="rateLimit"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="rateLimit" className="text-sm font-medium text-foreground">
          Enable Rate Limiting
        </label>
      </div>
      {enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Max Messages
              </label>
              <input
                type="number"
                value={messages}
                onChange={(e) => setMessages(parseInt(e.target.value))}
                min={1}
                max={1000}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Window (minutes)
              </label>
              <input
                type="number"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(parseInt(e.target.value))}
                min={1}
                max={1440}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Error Message
            </label>
            <input
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder="Rate limit exceeded. Please try again later."
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
        </>
      )}
      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
