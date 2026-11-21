"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Download, ImageIcon, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CharacterCard, type CharacterState } from "@/components/comic/character-card";
import { ComicGrid, cssAspect, PanelFigure, type PanelState } from "@/components/comic/panel-figure";
import { ScriptEditor } from "@/components/create/script-editor";
import { SettingsForm } from "@/components/create/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ai, checkIdea } from "@/lib/ai";
import { repo, useRepoQuery } from "@/lib/data";
import { downloadComicPage } from "@/lib/download";
import { regeneratePanel, runGeneration } from "@/lib/generate";
import { estimateCost, formatCost, getQuality, PANEL_COUNTS } from "@/lib/presets";
import type { GenerationSettings, Script } from "@/lib/types";

type Phase = "idle" | "scripting" | "review" | "drawing" | "done";

const DEFAULT_SETTINGS: GenerationSettings = {
  style: "comic",
  panelCount: 4,
  aspectRatio: "1:1",
  colorMode: "full",
  tone: "funny",
  quality: "low",
  enhance: true,
};

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

export function CreateView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const remixId = searchParams.get("from");

  const [idea, setIdea] = useState("");
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [script, setScript] = useState<Script | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [character, setCharacter] = useState<CharacterState>({ status: "idle" });
  const [regenerating, setRegenerating] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // Remix: prefill from an existing generation.
  useEffect(() => {
    if (!remixId) return;
    repo.getGeneration(remixId).then((found) => {
      if (!found) return;
      setIdea(found.generation.idea);
      const s = found.generation.settings;
      // Older comics may use a panel count that's disabled while testing.
      const allowed = (PANEL_COUNTS as readonly number[]).includes(s.panelCount);
      setSettings(allowed ? s : { ...s, panelCount: 4 });
    });
  }, [remixId]);

  const query = useCallback(
    (r: typeof repo) => (generationId ? r.getGeneration(generationId) : Promise.resolve(null)),
    [generationId]
  );
  const { data: current } = useRepoQuery(query);
  const saved = current?.generation.saved ?? false;

  const busy = phase === "scripting" || phase === "drawing";
  const formLocked = busy || phase === "review";
  const activeCount = phase === "idle" ? settings.panelCount : panels.length || settings.panelCount;
  const activeAspect = current?.generation.settings.aspectRatio ?? settings.aspectRatio;

  async function draw(withScript: Script | null) {
    const n = settings.panelCount;
    setPhase("drawing");
    setGenerationId(null);
    setPanels(Array.from({ length: n }, () => ({ status: "loading" })));
    setCharacter({ status: "loading" });
    try {
      await runGeneration({
        idea,
        settings,
        script: withScript,
        onCreated: setGenerationId,
        onCharacter: (c) => setCharacter({ status: "done", character: c }),
        onPanel: (e) =>
          setPanels((prev) =>
            prev.map((p, i) =>
              i !== e.index ? p : e.status === "done" ? { status: "done", image: e.image } : { status: "error", error: e.error }
            )
          ),
      });
    } catch (err) {
      toast.error(errorMessage(err));
      // Character failed: no panels were drawn.
      setCharacter((c) => (c.status === "loading" ? { status: "error", error: errorMessage(err) } : c));
      setPanels((prev) =>
        prev.map((p) => (p.status === "loading" ? { status: "error", error: "Not drawn: the character failed." } : p))
      );
    } finally {
      setPhase("done");
    }
  }

  async function handlePrimary() {
    const problem = checkIdea(idea);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (phase === "review") {
      await draw(script);
      return;
    }
    if (!settings.enhance) {
      setScript(null);
      await draw(null);
      return;
    }
    setPhase("scripting");
    setPanels([]);
    setCharacter({ status: "idle" });
    setGenerationId(null);
    try {
      const next = await ai.writeScript(idea, settings);
      setScript(next);
      setPhase("review");
    } catch (err) {
      toast.error(errorMessage(err));
      setPhase("idle");
    }
  }

  async function handleRegenerate(index: number) {
    if (!generationId) return;
    const state = panels[index];
    setRegenerating((s) => new Set(s).add(index));
    try {
      const image = await regeneratePanel({
        generationId,
        panelIndex: index,
        previousImageId: state.status === "done" ? state.image.id : undefined,
      });
      setPanels((prev) => prev.map((p, i) => (i === index ? { status: "done", image } : p)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRegenerating((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      });
    }
  }

  async function handleSave() {
    if (!generationId) return;
    try {
      await repo.updateGeneration(generationId, { saved: !saved });
      if (!saved)
        toast.success("Saved to your library", {
          action: { label: "View", onClick: () => router.push(`/library/${generationId}`) },
        });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDownload() {
    if (!current) return;
    setDownloading(true);
    try {
      await downloadComicPage(current.generation.title, current.images);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  function startOver() {
    setPhase("idle");
    setScript(null);
    setPanels([]);
    setCharacter({ status: "idle" });
    setGenerationId(null);
  }

  const primaryLabel =
    phase === "scripting"
      ? "Writing script…"
      : phase === "drawing"
        ? "Drawing panels…"
        : phase === "review" || !settings.enhance
          ? `Generate ${settings.panelCount} ${settings.panelCount === 1 ? "image" : "images"}`
          : "Write script";

  const finishedImages = panels.filter((p) => p.status === "done").length;

  return (
    <>
      <PageHeader
        title="Create"
        description="Describe a scene. Claude writes the script, then each panel is drawn."
        actions={
          phase !== "idle" && !busy ? (
            <Button variant="outline" onClick={startOver}>
              <RotateCcw /> Start over
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="w-full gap-0 py-5 lg:sticky lg:top-8 lg:max-w-[420px]">
          <CardContent className="px-5">
            <SettingsForm
              idea={idea}
              onIdeaChange={setIdea}
              settings={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              disabled={formLocked}
            />
            <div className="mt-6 flex flex-col gap-2 border-t pt-5">
              <Button size="lg" className="w-full" onClick={handlePrimary} disabled={busy}>
                <Sparkles className={busy ? "animate-pulse" : undefined} />
                {primaryLabel}
              </Button>
              {phase === "review" && (
                <Button variant="ghost" onClick={() => setPhase("idle")}>
                  <Pencil /> Edit prompt or settings
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                1 generation · {settings.panelCount} {settings.panelCount === 1 ? "image" : "images"} · ≈
                {formatCost(estimateCost(settings.quality, settings.panelCount))} with{" "}
                {getQuality(settings.quality).modelName}
              </p>
            </div>
          </CardContent>
        </Card>

        <section aria-label="Result" className="flex min-w-0 flex-1 flex-col gap-5">
          {phase === "scripting" && (
            <Card>
              <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
                Claude is writing your script…
              </CardContent>
            </Card>
          )}

          {script && phase !== "scripting" && (
            <ScriptEditor script={script} onChange={setScript} readOnly={phase !== "review"} />
          )}

          <Card className="gap-4 py-4">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-4">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription className="mt-1">
                  {phase === "drawing"
                    ? character.status === "loading"
                      ? "Designing the character…"
                      : `${finishedImages} of ${panels.length} panels ready`
                    : phase === "done"
                      ? current?.generation.title
                      : "Your panels will appear here"}
                </CardDescription>
              </div>
              {phase === "done" && generationId && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading || !finishedImages}>
                    <Download /> {downloading ? "Preparing…" : "Download"}
                  </Button>
                  <Button size="sm" variant={saved ? "outline" : "default"} onClick={handleSave} disabled={!finishedImages}>
                    {saved ? <BookmarkCheck /> : <Bookmark />}
                    {saved ? "Saved" : "Save to library"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
              <CharacterCard state={character} />
              {panels.length === 0 ? (
                <ComicGrid count={activeCount}>
                  {Array.from({ length: activeCount }, (_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center rounded-xl border border-dashed bg-background"
                      style={{ aspectRatio: cssAspect(settings.aspectRatio) }}
                    >
                      <ImageIcon className="size-6 text-chart-4" aria-hidden />
                    </div>
                  ))}
                </ComicGrid>
              ) : (
                <ComicGrid count={panels.length}>
                  {panels.map((state, i) => (
                    <PanelFigure
                      key={i}
                      index={i}
                      state={state}
                      aspect={cssAspect(activeAspect)}
                      caption={state.status === "done" ? state.image.caption : undefined}
                      regenerating={regenerating.has(i)}
                      onRegenerate={phase === "done" ? () => handleRegenerate(i) : undefined}
                    />
                  ))}
                </ComicGrid>
              )}
            </CardContent>
          </Card>

          {phase === "done" && saved && generationId && (
            <p className="text-sm text-muted-foreground">
              Saved.{" "}
              <Link href={`/library/${generationId}`} className="font-medium text-primary hover:underline">
                Open in library
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
