"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Download, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ComicGrid, cssAspect, PanelFigure } from "@/components/comic/panel-figure";
import { ScriptEditor } from "@/components/create/script-editor";
import { DeleteGenerationDialog } from "@/components/library/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CharacterCard } from "@/components/comic/character-card";
import { Skeleton } from "@/components/ui/skeleton";
import { repo, useRepoQuery } from "@/lib/data";
import { downloadComicPage } from "@/lib/download";
import { formatDateTime } from "@/lib/format";
import { regeneratePanel } from "@/lib/generate";
import { describeFace, getAspect, getColorMode, getLanguage, getStyle, getQuality, getTone } from "@/lib/presets";

export function DetailView({ id }: { id: string }) {
  const router = useRouter();
  const query = useCallback((r: typeof repo) => r.getGeneration(id), [id]);
  const { data, loading } = useRepoQuery(query);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (data) document.title = `${data.generation.title} · Panelforge`;
  }, [data]);

  if (loading || deleted) return <DetailSkeleton />;

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
        <p className="font-semibold">Generation not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted, or it was made in another browser.</p>
        <Button asChild className="mt-3">
          <Link href="/library">Back to library</Link>
        </Button>
      </div>
    );
  }

  const { generation: g, images, character } = data;
  const s = g.settings;

  async function toggleSave() {
    await repo.updateGeneration(g.id, { saved: !g.saved });
    toast.success(g.saved ? "Removed from library" : "Saved to library");
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadComicPage(g.title, images, { lang: s.language });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function regenerate(index: number) {
    const prev = images.find((i) => i.panelIndex === index);
    setRegenerating((set) => new Set(set).add(index));
    try {
      await regeneratePanel({ generationId: g.id, panelIndex: index, previousImageId: prev?.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate");
    } finally {
      setRegenerating((set) => {
        const next = new Set(set);
        next.delete(index);
        return next;
      });
    }
  }

  const details: [string, string][] = [
    ["Style", getStyle(s.style).name],
    ["Layout", `${s.panelCount} ${s.panelCount === 1 ? "panel" : "panels"} · ${getAspect(s.aspectRatio).id}`],
    ["Colour", getColorMode(s.colorMode).name],
    ["Tone", getTone(s.tone).name],
    ["Language", getLanguage(s.language).name],
    ...(describeFace(s.face) ? ([["Character look", describeFace(s.face)]] as [string, string][]) : []),
    ["Script", s.enhance ? "Claude" : g.script ? "Your prompt" : "Prompt only"],
    ["Reviewed", (s.reviewScript ?? s.enhance) ? "Yes" : "No"],
    ...(s.quality ? ([["Quality", getQuality(s.quality).name]] as [string, string][]) : []),
    ["Image model", g.model],
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground">
          Library
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-foreground">{g.title}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{g.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{getStyle(s.style).name}</Badge>
            <Badge variant="secondary">
              {images.length} {images.length === 1 ? "image" : "images"}
            </Badge>
            {g.saved ? (
              <Badge className="bg-plum-soft text-plum-soft-foreground">Saved</Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
            <span className="ml-1 text-sm text-muted-foreground">Created {formatDateTime(g.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/create?from=${g.id}`}>
              <Shuffle /> Remix
            </Link>
          </Button>
          <Button variant="outline" onClick={toggleSave}>
            {g.saved ? <BookmarkCheck /> : <Bookmark />}
            {g.saved ? "Saved" : "Save"}
          </Button>
          <Button onClick={download} disabled={downloading || !images.length}>
            <Download /> {downloading ? "Preparing…" : "Download"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1 py-4">
          <CardContent className="flex flex-col gap-3 px-4">
            {character && <CharacterCard state={{ status: "done", character }} />}
            <ComicGrid count={s.panelCount}>
              {Array.from({ length: s.panelCount }, (_, i) => {
                const img = images.find((x) => x.panelIndex === i);
                return (
                  <PanelFigure
                    key={i}
                    index={i}
                    state={img ? { status: "done", image: img } : { status: "error", error: "This panel failed" }}
                    aspect={cssAspect(s.aspectRatio)}
                    caption={img?.caption}
                    lang={s.language}
                    regenerating={regenerating.has(i)}
                    onRegenerate={() => regenerate(i)}
                  />
                );
              })}
            </ComicGrid>
          </CardContent>
        </Card>

        <aside className="flex w-full flex-col gap-4 lg:max-w-sm">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-sm">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="px-5 text-sm leading-relaxed text-muted-foreground">{g.idea}</CardContent>
          </Card>

          {g.script && (
            <ScriptEditor
              script={g.script}
              readOnly
              sourceLabel={s.enhance ? "Written by Claude" : "Written from your prompt"}
            />
          )}

          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="m-0 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <DeleteGenerationDialog
        generationId={g.id}
        title={g.title}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={() => {
          setDeleted(true);
          router.push("/library");
        }}
      />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="aspect-[4/3] w-full max-w-3xl rounded-xl" />
    </div>
  );
}
