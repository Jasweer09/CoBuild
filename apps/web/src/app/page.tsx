import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          Enterprise AI Chatbot Platform
        </div>
        <h1 className="mb-6 text-6xl font-bold tracking-tight text-foreground">
          Co<span className="text-primary">Build</span>
        </h1>
        <p className="mb-10 text-xl text-muted-foreground">
          Build intelligent, white-labeled AI chatbots for your business. Train on your data,
          deploy anywhere, scale effortlessly.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="#features"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
