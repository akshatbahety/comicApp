"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { GenerationCard } from "@/components/library/generation-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repo, useRepoQuery } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";
import { getStyle, STYLES, type StyleId } from "@/lib/presets";
import { cn } from "@/lib/utils";

type View = "generations" | "images";
type Sort = "newest" | "oldest" | "most";

export function LibraryView() {
  const [view, setView] = useState<View>("generations");
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<StyleId | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");

  const genQuery = useCallback((r: typeof repo) => r.listGenerations({ savedOnly: true }), []);
  const imgQuery = useCallback((r: typeof repo) => r.listImages({ savedOnly: true }), []);
  const gens = useRepoQuery(genQuery);
  const imgs = useRepoQuery(imgQuery);

  const q = query.trim().toLowerCase();

  const generations = useMemo(() => {
    const list = (gens.data ?? []).filter(({ generation: g, images }) => {
      if (style !== "all" && g.settings.style !== style) return false;
      if (!q) return true;
      const haystack = [g.title, g.idea, ...images.map((i) => i.caption), ...(g.script?.panels.map((p) => p.scene) ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    if (sort === "oldest") list.reverse();
    if (sort === "most") list.sort((a, b) => b.images.length - a.images.length);
    return list;
  }, [gens.data, style, q, sort]);

  const images = useMemo(() => {
    const list = (imgs.data ?? []).filter((img) => {
      if (style !== "all" && img.generation.settings.style !== style) return false;
      if (!q) return true;
      return [img.generation.title, img.generation.idea, img.caption].join(" ").toLowerCase().includes(q);
    });
    if (sort === "oldest") list.reverse();
    return list;
  }, [imgs.data, style, q, sort]);

  const totalGenerations = gens.data?.length ?? 0;
  const totalImages = imgs.data?.length ?? 0;
  const loading = view === "generations" ? gens.loading : imgs.loading;
  const shown = view === "generations" ? generations.length : images.length;
  const libraryEmpty = !gens.loading && totalGenerations === 0;

  return (
    <>
      <PageHeader
        title="Library"
        description={
          gens.loading ? " " : `${totalGenerations} saved ${totalGenerations === 1 ? "generation" : "generations"} · ${totalImages} images`
        }
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="generations">Generations</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {libraryEmpty ? (
        <EmptyState
          title="Your library is empty"
          body="Generate something and press “Save to library” to keep it here."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                aria-label="Search your library"
                placeholder="Search titles, prompts and captions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 bg-card pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort" className="h-10 w-40 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                {view === "generations" && <SelectItem value="most">Most images</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div role="group" aria-label="Filter by style" className="flex flex-wrap gap-1.5">
            {[{ id: "all", name: "All" } as const, ...STYLES].map((s) => {
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStyle(s.id as StyleId | "all")}
                  className={cn(
                    "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
                    active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent"
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>

          {loading ? (
            <Grid>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/3.6] rounded-xl" />
              ))}
            </Grid>
          ) : shown === 0 ? (
            <EmptyState title="No results" body="Nothing matches that search or filter." />
          ) : view === "generations" ? (
            <Grid>
              {generations.map((item) => (
                <GenerationCard key={item.generation.id} item={item} />
              ))}
            </Grid>
          ) : (
            <Grid>
              {images.map((img) => (
                <Link
                  key={img.id}
                  href={`/library/${img.generationId}`}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs"
                >
                  <img
                    src={img.url}
                    alt={img.caption || `Panel ${img.panelIndex + 1} of ${img.generation.title}`}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex flex-col gap-0.5 px-3.5 py-3">
                    <span className="truncate text-sm font-medium group-hover:underline">
                      {img.generation.title} · {img.panelIndex + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getStyle(img.generation.settings.style).name} · {formatRelativeDate(img.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </Grid>
          )}
        </div>
      )}
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">{children}</div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-3">
        <Link href="/create">
          <Plus /> New generation
        </Link>
      </Button>
    </div>
  );
}
