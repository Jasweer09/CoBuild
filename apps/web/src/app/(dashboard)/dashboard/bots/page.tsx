'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

interface Chatbot {
  id: string;
  name: string;
  slug: string;
  aiModel: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
  _count: { conversations: number };
}

interface ChatbotsResponse {
  chatbots: Chatbot[];
  totalDocs: number;
  totalPages: number;
  currentPage: number;
}

export default function BotsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['chatbots'],
    queryFn: () => api.get<ChatbotsResponse>('/chatbot'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/chatbot/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbots'] });
      toast.success('Chatbot deleted');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete');
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setCreating(true);

    try {
      await api.post('/chatbot', { name: newBotName.trim() });
      queryClient.invalidateQueries({ queryKey: ['chatbots'] });
      setShowCreate(false);
      setNewBotName('');
      toast.success('Chatbot created');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  const chatbots = data?.data?.chatbots ?? [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chatbots</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your AI chatbots
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Create Chatbot
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Create New Chatbot
          </h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newBotName}
              onChange={(e) => setNewBotName(e.target.value)}
              placeholder="Enter chatbot name..."
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewBotName('');
              }}
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && chatbots.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <p className="mb-2 text-lg font-medium text-foreground">
            No chatbots yet
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your first AI chatbot to get started.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Create Chatbot
          </button>
        </div>
      )}

      {/* Bot cards */}
      {!isLoading && chatbots.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chatbots.map((bot) => (
            <div
              key={bot.id}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <Link
                    href={`/dashboard/bots/${bot.id}`}
                    className="text-lg font-semibold text-foreground hover:text-primary"
                  >
                    {bot.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {bot.aiModel}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    bot.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {bot.status}
                </span>
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{bot._count.conversations} conversations</span>
                <span>{bot.isPublic ? 'Public' : 'Private'}</span>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/dashboard/bots/${bot.id}/chat`}
                  className="flex-1 rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary hover:bg-primary/20"
                >
                  Chat
                </Link>
                <Link
                  href={`/dashboard/bots/${bot.id}`}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-accent"
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    if (confirm('Delete this chatbot?')) {
                      deleteMutation.mutate(bot.id);
                    }
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
