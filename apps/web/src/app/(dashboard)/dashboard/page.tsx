const stats = [
  { label: 'Total Chatbots', value: '0', change: '' },
  { label: 'Messages Today', value: '0', change: '' },
  { label: 'Active Sessions', value: '0', change: '' },
  { label: 'Credits Remaining', value: '0', change: '' },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Welcome to CoBuild</h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your chatbot platform.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
