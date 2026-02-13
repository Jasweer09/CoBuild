import Link from 'next/link';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/dashboard/bots', label: 'Chatbots', icon: 'bot' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'chart' },
  { href: '/dashboard/billing', label: 'Billing', icon: 'credit-card' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/dashboard" className="text-xl font-bold text-foreground">
            Co<span className="text-primary">Build</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="ml-64 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-card/80 px-8 backdrop-blur-sm">
          <div className="ml-auto flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-primary/10" />
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
