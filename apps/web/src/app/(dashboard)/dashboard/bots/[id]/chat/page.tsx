'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Message {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  isPinned: boolean;
  updatedAt: string;
  messages: { content: string; role: string; createdAt: string }[];
  _count: { messages: number };
}

interface Chatbot {
  id: string;
  name: string;
  initialMessage: string | null;
  suggestedMessages: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ChatPage() {
  const { id: chatbotId } = useParams<{ id: string }>();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chatbot info
  const { data: botData } = useQuery({
    queryKey: ['chatbot', chatbotId],
    queryFn: () => api.get<{ chatbot: Chatbot }>(`/chatbot/${chatbotId}`),
  });

  // Fetch conversations list
  const { data: convsData, refetch: refetchConvs } = useQuery({
    queryKey: ['conversations', chatbotId],
    queryFn: () =>
      api.get<{ conversations: Conversation[] }>(
        `/conversation/bot/${chatbotId}?limit=50`,
      ),
  });

  const bot = botData?.data?.chatbot;
  const conversations = convsData?.data?.conversations ?? [];

  // Load conversation messages
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const res = await api.get<{
        conversation: { messages: Message[] };
      }>(`/conversation/${convId}`);
      setMessages(res.data.conversation.messages);
      setConversationId(convId);
    } catch {
      // ignore
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Send message with SSE streaming
  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      role: 'USER',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatbotId,
          conversationId,
          content: content.trim(),
        }),
      });

      // Get conversation ID from header
      const newConvId = response.headers.get('X-Conversation-Id');
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
        refetchConvs();
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }

                if (data.isComplete) {
                  // Finalize
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `ai-${Date.now()}`,
                      content: fullContent,
                      role: 'ASSISTANT',
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                  setStreamingContent('');
                  refetchConvs();
                }

                if (data.error) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `error-${Date.now()}`,
                      content: 'Sorry, something went wrong. Please try again.',
                      role: 'ASSISTANT',
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                  setStreamingContent('');
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          content: 'Failed to connect. Please check your connection.',
          role: 'ASSISTANT',
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setStreamingContent('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Conversation sidebar */}
      <aside className="w-72 shrink-0 border-r border-border bg-card/50 flex flex-col">
        <div className="flex items-center justify-between border-b border-border p-3">
          <Link
            href={`/dashboard/bots/${chatbotId}`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {bot?.name ?? 'Chatbot'}
          </Link>
          <button
            onClick={startNewChat}
            className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                conv.id === conversationId
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <p className="truncate font-medium">{conv.title || 'Untitled'}</p>
              <p className="mt-0.5 truncate text-xs opacity-70">
                {conv.messages?.[0]?.content?.slice(0, 40) || 'No messages'}
              </p>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No conversations yet
            </p>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="flex h-full flex-col items-center justify-center">
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                {bot?.initialMessage || 'Start a conversation'}
              </h2>
              {bot?.suggestedMessages && bot.suggestedMessages.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {bot.suggestedMessages.map((msg, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(msg)}
                      className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'USER'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
                <span className="inline-block h-4 w-1 animate-pulse bg-foreground/50" />
              </div>
            </div>
          )}

          {/* Streaming indicator (before content arrives) */}
          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={isStreaming}
              className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-ring focus:ring-2 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="h-[44px] rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Powered by CoBuild AI
          </p>
        </div>
      </div>
    </div>
  );
}
