'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetAppearance {
  theme: 'light' | 'dark';
  headerColor: string;
  headerTextColor: string;
  botAvatar: string;
  userAvatar: string;
  chatBubbleColor: string;
  position: 'bottom-right' | 'bottom-left';
}

interface WidgetConfig {
  chatbotId: string;
  name: string;
  initialMessage: string | null;
  appearance: WidgetAppearance | null;
  isPublic: boolean;
  passwordProtected: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Default appearance
// ---------------------------------------------------------------------------

const DEFAULT_APPEARANCE: WidgetAppearance = {
  theme: 'light',
  headerColor: '#6366f1',
  headerTextColor: '#ffffff',
  botAvatar: '',
  userAvatar: '',
  chatBubbleColor: '#6366f1',
  position: 'bottom-right',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EmbedPage() {
  const { chatbotId } = useParams<{ chatbotId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['widget-config', chatbotId],
    queryFn: () =>
      api.get<WidgetConfig>(`/widget/${chatbotId}/config`),
  });

  const config = data?.data;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !config) {
    return <ErrorScreen />;
  }

  if (config.passwordProtected) {
    return <PasswordGate config={config} />;
  }

  return <ChatWidget config={config} />;
}

// ---------------------------------------------------------------------------
// Loading Screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading chat...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Screen
// ---------------------------------------------------------------------------

function ErrorScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <svg
          className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <p className="mb-1 text-sm font-medium text-foreground">
          Chat Unavailable
        </p>
        <p className="text-xs text-muted-foreground">
          This chatbot could not be loaded. Please check the link and try again.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password Gate
// ---------------------------------------------------------------------------

function PasswordGate({ config }: { config: WidgetConfig }) {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const appearance = config.appearance ?? DEFAULT_APPEARANCE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setChecking(true);
    setError('');

    try {
      // Try to validate the password by sending it as a header or query
      // For now, store locally and pass to widget
      // In production, this would validate against the backend
      setUnlocked(true);
    } catch {
      setError('Invalid password. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) {
    return <ChatWidget config={config} />;
  }

  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{
        backgroundColor:
          appearance.theme === 'dark' ? '#111827' : '#f9fafb',
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6 shadow-lg"
        style={{
          backgroundColor:
            appearance.theme === 'dark' ? '#1f2937' : '#ffffff',
          borderColor:
            appearance.theme === 'dark' ? '#374151' : '#e5e7eb',
        }}
      >
        <div
          className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: appearance.headerColor,
            color: appearance.headerTextColor,
          }}
        >
          <div className="h-6 w-6 rounded-full bg-white/20" />
          <span className="text-sm font-medium">{config.name}</span>
        </div>

        <h2
          className="mb-2 text-base font-semibold"
          style={{
            color: appearance.theme === 'dark' ? '#f9fafb' : '#111827',
          }}
        >
          Password Required
        </h2>
        <p
          className="mb-4 text-sm"
          style={{
            color: appearance.theme === 'dark' ? '#9ca3af' : '#6b7280',
          }}
        >
          This chat is password protected. Please enter the password to
          continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
            style={{
              backgroundColor:
                appearance.theme === 'dark' ? '#111827' : '#ffffff',
              borderColor:
                appearance.theme === 'dark' ? '#374151' : '#d1d5db',
              color:
                appearance.theme === 'dark' ? '#f9fafb' : '#111827',
            }}
          />
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !password.trim()}
            className="h-10 w-full rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: appearance.headerColor }}
          >
            {checking ? 'Checking...' : 'Enter Chat'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Widget
// ---------------------------------------------------------------------------

function ChatWidget({ config }: { config: WidgetConfig }) {
  const appearance = config.appearance ?? DEFAULT_APPEARANCE;
  const isDark = appearance.theme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initial: ChatMessage[] = [];
    if (config.initialMessage) {
      initial.push({
        id: 'initial',
        role: 'bot',
        content: config.initialMessage,
        timestamp: new Date(),
      });
    }
    return initial;
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      // Placeholder: In production, this would call a conversation/message endpoint
      // For now, show a simulated bot response
      await new Promise((resolve) => setTimeout(resolve, 800));
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content:
          'Thank you for your message. This is a preview of the embedded chat widget. Connect it to your backend to enable real conversations.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  const bgColor = isDark ? '#111827' : '#ffffff';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const inputBg = isDark ? '#1f2937' : '#ffffff';
  const inputBorder = isDark ? '#374151' : '#d1d5db';
  const botBubbleBg = isDark ? '#374151' : '#f3f4f6';
  const botBubbleText = isDark ? '#e5e7eb' : '#374151';

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-3 shadow-sm"
        style={{
          backgroundColor: appearance.headerColor,
          color: appearance.headerTextColor,
        }}
      >
        {appearance.botAvatar ? (
          <img
            src={appearance.botAvatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {config.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold">{config.name}</p>
          <p className="text-xs opacity-80">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm" style={{ color: mutedColor }}>
              Start a conversation...
            </p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                style={
                  msg.role === 'user'
                    ? {
                        backgroundColor: appearance.chatBubbleColor,
                        color: '#ffffff',
                      }
                    : {
                        backgroundColor: botBubbleBg,
                        color: botBubbleText,
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: botBubbleBg,
                  color: botBubbleText,
                }}
              >
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{
                      backgroundColor: mutedColor,
                      animationDelay: '0ms',
                    }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{
                      backgroundColor: mutedColor,
                      animationDelay: '150ms',
                    }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{
                      backgroundColor: mutedColor,
                      animationDelay: '300ms',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{
          borderColor: inputBorder,
          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
        }}
      >
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="h-10 flex-1 rounded-lg border px-3 text-sm outline-none disabled:opacity-50"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorder,
              color: textColor,
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: appearance.headerColor }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
