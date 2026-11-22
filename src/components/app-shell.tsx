import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "./auth/account-menu";
import { ActiveNav, NavLinks } from "./nav";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 py-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary">
        <svg
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-sidebar-primary-foreground"
          strokeWidth={2}
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="18" height="8" rx="1.5" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight">Panelforge</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-sidebar px-3 py-3 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:gap-6 md:border-r md:border-b-0 md:py-5">
        <Logo />
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNav />
        </Suspense>
        <Suspense>
          <AccountMenu />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
