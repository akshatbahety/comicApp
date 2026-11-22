"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { repo } from "@/lib/data";
import { importLocalComics } from "@/lib/data/import-local";
import type { SupabaseRepository } from "@/lib/data/supabase-repository";
import { getSupabase } from "@/lib/supabase/client";

/** Signed-in email and a sign-out button, shown at the bottom of the sidebar. */
export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getSupabase().auth;
    const apply = (user: { id: string; email?: string } | null | undefined) => {
      setEmail(user?.email ?? null);
      if (!user) return;
      importLocalComics(repo as SupabaseRepository, user.id).then(
        (r) => {
          if (!r) return;
          toast.success(
            `Imported ${r.comics} comic${r.comics === 1 ? "" : "s"} from this browser` +
              (r.skippedImages ? ` (${r.skippedImages} expired image${r.skippedImages === 1 ? "" : "s"} skipped)` : "")
          );
        },
        (err: unknown) => toast.error(`Couldn't import comics from this browser: ${err instanceof Error ? err.message : err}`)
      );
    };
    auth.getUser().then(({ data }) => apply(data.user));
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") apply(session?.user);
      else setEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!email || pathname === "/login") return null;

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mt-auto flex items-center gap-2 px-2 md:flex-col md:items-stretch">
      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </p>
      <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
