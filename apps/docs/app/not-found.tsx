import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-fd-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/docs/en"
        className="inline-flex items-center rounded-md border border-fd-border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
      >
        Back to documentation
      </Link>
    </main>
  );
}
