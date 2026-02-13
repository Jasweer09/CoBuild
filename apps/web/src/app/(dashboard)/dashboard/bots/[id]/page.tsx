'use client';

import { useState, useEffect } from 'react';
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

interface EmbedAppearance {
  theme: 'light' | 'dark';
  headerColor: string;
  headerTextColor: string;
  botAvatar: string;
  userAvatar: string;
  chatBubbleColor: string;
  position: 'bottom-right' | 'bottom-left';
}

interface EmbedSettings {
  appearance: EmbedAppearance | null;
  embedAllowedDomains: string[];
  isPublic: boolean;
  hasPassword: boolean;
}

type Tab = 'general' | 'ai' | 'appearance' | 'rate-limit' | 'embed' | 'deployment';

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
    { key: 'embed', label: 'Embed' },
    { key: 'deployment', label: 'Deployment' },
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
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/bots/${id}/knowledge`}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Knowledge Base
          </Link>
          <Link
            href={`/dashboard/bots/${id}/chat`}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Chat
          </Link>
        </div>
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
            Appearance settings are now in the Embed tab below.
          </div>
        )}
        {tab === 'rate-limit' && (
          <RateLimitTab bot={bot} onSave={(d) => updateMutation.mutate(d)} saving={updateMutation.isPending} />
        )}
        {tab === 'embed' && <EmbedTab chatbotId={id} />}
        {tab === 'deployment' && <DeploymentTab chatbotId={id} />}
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

// ===========================================================================
// Helper: Color Input
// ===========================================================================

function ColorInput({
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

// ===========================================================================
// Embed Tab
// ===========================================================================

const DEFAULT_APPEARANCE: EmbedAppearance = {
  theme: 'light',
  headerColor: '#6366f1',
  headerTextColor: '#ffffff',
  botAvatar: '',
  userAvatar: '',
  chatBubbleColor: '#6366f1',
  position: 'bottom-right',
};

function EmbedTab({ chatbotId }: { chatbotId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['embed-settings', chatbotId],
    queryFn: () =>
      api.get<{ embedSettings: EmbedSettings }>(
        `/deployment/embed/${chatbotId}`,
      ),
  });

  const embedSettings = data?.data?.embedSettings;

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [headerColor, setHeaderColor] = useState('#6366f1');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [chatBubbleColor, setChatBubbleColor] = useState('#6366f1');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>(
    'bottom-right',
  );
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (embedSettings && !initialized) {
      const a = embedSettings.appearance ?? DEFAULT_APPEARANCE;
      setTheme(a.theme);
      setHeaderColor(a.headerColor);
      setHeaderTextColor(a.headerTextColor);
      setChatBubbleColor(a.chatBubbleColor);
      setPosition(a.position);
      setDomains(embedSettings.embedAllowedDomains ?? []);
      setPasswordProtected(embedSettings.hasPassword);
      setInitialized(true);
    }
  }, [embedSettings, initialized]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/deployment/embed/${chatbotId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embed-settings', chatbotId] });
      toast.success('Embed settings saved');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to save embed settings',
      );
    },
  });

  const appearanceMutation = useMutation({
    mutationFn: (appearance: Record<string, unknown>) =>
      api.patch(`/deployment/embed/${chatbotId}/appearance`, { appearance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embed-settings', chatbotId] });
      toast.success('Appearance saved');
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to save appearance',
      );
    },
  });

  function handleAddDomain() {
    const d = newDomain.trim();
    if (!d) return;
    if (domains.includes(d)) {
      toast.error('Domain already added');
      return;
    }
    setDomains([...domains, d]);
    setNewDomain('');
  }

  function handleRemoveDomain(domain: string) {
    setDomains(domains.filter((dd) => dd !== domain));
  }

  function handleSaveAppearance() {
    appearanceMutation.mutate({
      theme,
      headerColor,
      headerTextColor,
      chatBubbleColor,
      position,
    });
  }

  function handleSaveSettings() {
    const body: Record<string, unknown> = {
      embedAllowedDomains: domains,
      passwordProtected,
    };
    if (passwordProtected && password) {
      body.password = password;
    }
    saveMutation.mutate(body);
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Widget Appearance */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Widget Appearance
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Theme toggle */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Theme
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <ColorInput
              label="Header Color"
              value={headerColor}
              onChange={setHeaderColor}
            />
            <ColorInput
              label="Header Text Color"
              value={headerTextColor}
              onChange={setHeaderTextColor}
            />
            <ColorInput
              label="Chat Bubble Color"
              value={chatBubbleColor}
              onChange={setChatBubbleColor}
            />

            {/* Position selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Widget Position
              </label>
              <select
                value={position}
                onChange={(e) =>
                  setPosition(
                    e.target.value as 'bottom-right' | 'bottom-left',
                  )
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSaveAppearance}
              disabled={appearanceMutation.isPending}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {appearanceMutation.isPending
                ? 'Saving...'
                : 'Save Appearance'}
            </button>
          </div>

          {/* Preview */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Preview
            </label>
            <div
              className={`overflow-hidden rounded-xl border border-border ${
                theme === 'dark' ? 'bg-gray-900' : 'bg-white'
              }`}
              style={{ minHeight: 320 }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  backgroundColor: headerColor,
                  color: headerTextColor,
                }}
              >
                <div className="h-8 w-8 rounded-full bg-white/20" />
                <span className="text-sm font-medium">Chat Widget</span>
              </div>
              {/* Messages area */}
              <div className="space-y-3 p-4">
                <div className="flex justify-start">
                  <div
                    className="max-w-[70%] rounded-lg px-3 py-2 text-xs"
                    style={{
                      backgroundColor:
                        theme === 'dark' ? '#374151' : '#f3f4f6',
                      color: theme === 'dark' ? '#e5e7eb' : '#374151',
                    }}
                  >
                    Hello! How can I help you?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div
                    className="max-w-[70%] rounded-lg px-3 py-2 text-xs text-white"
                    style={{ backgroundColor: chatBubbleColor }}
                  >
                    I have a question about pricing.
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="max-w-[70%] rounded-lg px-3 py-2 text-xs"
                    style={{
                      backgroundColor:
                        theme === 'dark' ? '#374151' : '#f3f4f6',
                      color: theme === 'dark' ? '#e5e7eb' : '#374151',
                    }}
                  >
                    Sure! I would be happy to help with that.
                  </div>
                </div>
              </div>
              {/* Input */}
              <div className="border-t border-border p-3">
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{
                    backgroundColor:
                      theme === 'dark' ? '#1f2937' : '#ffffff',
                    borderColor:
                      theme === 'dark' ? '#374151' : '#e5e7eb',
                    color: theme === 'dark' ? '#9ca3af' : '#9ca3af',
                  }}
                >
                  Type a message...
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Position: {position === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
            </p>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* Allowed Domains */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Allowed Domains
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Leave empty to allow embedding on any domain.
        </p>
        <div className="flex gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDomain();
              }
            }}
            className="h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
          />
          <button
            type="button"
            onClick={handleAddDomain}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Add
          </button>
        </div>
        {domains.length > 0 && (
          <div className="mt-3 space-y-2">
            {domains.map((domain) => (
              <div
                key={domain}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-foreground">{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(domain)}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* Password Protection */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Password Protection
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPasswordProtected(!passwordProtected)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              passwordProtected ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                passwordProtected ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-foreground">
            Require password to access widget
          </span>
        </div>
        {passwordProtected && (
          <div className="mt-3">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password"
              className="h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty to keep the current password.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={saveMutation.isPending}
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saveMutation.isPending ? 'Saving...' : 'Save Embed Settings'}
      </button>
    </div>
  );
}

// ===========================================================================
// Deployment Tab
// ===========================================================================

function DeploymentTab({ chatbotId }: { chatbotId: string }) {
  const APP_URL =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { data, isLoading } = useQuery({
    queryKey: ['embed-code', chatbotId],
    queryFn: () =>
      api.get<{ embedCode: string; scriptTag: string }>(
        `/deployment/embed/${chatbotId}/code`,
      ),
  });

  const embedCode = data?.data?.embedCode ?? '';
  const scriptTag = data?.data?.scriptTag ?? '';
  const shareLink = `${APP_URL}/embed/${chatbotId}`;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error('Failed to copy'),
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Embed Code */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Embed Code
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Add this script tag to your website to embed the chat widget. Place it
          just before the closing &lt;/body&gt; tag.
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-sm text-foreground">
            <code>{scriptTag || embedCode || '<!-- Loading embed code... -->'}</code>
          </pre>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(scriptTag || embedCode, 'Embed code')
            }
            className="absolute right-3 top-3 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            Copy
          </button>
        </div>
      </div>

      <hr className="border-border" />

      {/* Share Link */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Share Link
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Share this direct link to open the chat widget in a standalone page.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareLink}
            className="h-10 w-full rounded-lg border border-input bg-muted/50 px-3 text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(shareLink, 'Share link')}
            className="h-10 shrink-0 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Copy
          </button>
        </div>
      </div>

      <hr className="border-border" />

      {/* Instructions */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
        <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
          Integration Instructions
        </h4>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-blue-700 dark:text-blue-400">
          <li>
            Copy the embed code above and paste it into your HTML page before
            the closing &lt;/body&gt; tag.
          </li>
          <li>
            The widget will appear as a floating chat button in the configured
            position.
          </li>
          <li>
            To restrict which domains can embed the widget, configure allowed
            domains in the Embed tab.
          </li>
          <li>
            Alternatively, share the direct link for a standalone chat
            experience.
          </li>
        </ol>
      </div>
    </div>
  );
}
