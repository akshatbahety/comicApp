"use client";

import { useCallback, useEffect, useState } from "react";
import { LocalRepository } from "./local-repository";
import type { Repository } from "./repository";

export type * from "./repository";

/** The app-wide repository. Swap this line for the Supabase implementation in Phase 2. */
export const repo: Repository = new LocalRepository();

/**
 * Runs a repository query and re-runs it whenever data changes.
 * `query` should be stable (wrap inline functions in useCallback).
 */
export function useRepoQuery<T>(query: (r: Repository) => Promise<T>) {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({
    data: undefined,
    loading: true,
    error: null,
  });

  const run = useCallback(() => {
    query(repo).then(
      (data) => setState({ data, loading: false, error: null }),
      (error: unknown) =>
        setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error : new Error(String(error)) }))
    );
  }, [query]);

  useEffect(() => {
    run();
    return repo.subscribe(run);
  }, [run]);

  return state;
}
