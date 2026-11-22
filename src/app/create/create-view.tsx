"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Download, ImageIcon, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CharacterCard, type CharacterState } from "@/components/comic/character-card";
import { ComicGrid, cssAspect, PanelFigure, type PanelState } from "@/components/comic/panel-figure";
import { ScriptEditor } from "@/components/create/script-editor";
import { SettingsForm } from "@/components/create/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaywallDialog } from "@/components/billing/paywall-dialog";
import { ai, checkIdea } from "@/lib/ai";
import { billingEnabled, getBillingStatus, imagesLeft, saveDraft, takeDraft } from "@/lib/billing/client";
import { basicScript, finalizeScript, validateScript } from "@/lib/ai/prompts";
import { repo, useRepoQuery } from "@/lib/data";
import { downloadComicPage } from "@/lib/download";
import { regeneratePanel, runGeneration } from "@/lib/generate";
import { estimateCost, formatCost, getLanguage, getQuality, normalizeFace, PANEL_COUNTS } from "@/lib/presets";
import { getPrefs } from "@/lib/prefs";
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
  reviewScript: true,
};

/** A script is only reused when the idea, panel count and Enhance match the ones it was made for. */
// Language is part of the key (F-018): a kept script in one language must not be drawn under another.
const scriptKeyFor = (idea: string, s: GenerationSettings) =>
  `${idea.trim()}|${s.panelCount}|${s.enhance}|${s.language ?? "en"}`;

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
  // F-017 script review: the version last produced (for "edited"), the key it was
  // made for, inline validation errors, and an action waiting on the Replace confirm.
  const [baseline, setBaseline] = useState<Script | null>(null);
  const [scriptKey, setScriptKey] = useState<string | null>(null);
  const [scriptErrors, setScriptErrors] = useState<Record<string, string>>({});
  const [pendingReplace, setPendingReplace] = useState<(() => void) | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const restored = useRef<"draft" | "none" | null>(null);
  // F-019: the paywall shown when drawing needs a plan.
  const [paywall, setPaywall] = useState<{ open: boolean; checkoutAvailable: boolean; onHold: boolean }>({
    open: false,
    checkoutAvailable: true,
    onHold: false,
  });

  // Remix: prefill from an existing generation. Caption language precedence (F-018):
  // the remixed comic's language, else the remembered default, else English.
  useEffect(() => {
    const applyRememberedLanguage = () =>
      setSettings((cur) => ({ ...cur, language: getLanguage(getPrefs().language).id }));
    // Back from checkout (F-019): the saved draft wins over a remix or defaults.
    // Runs once even under StrictMode: the draft is consumed on the first read.
    if (restored.current === "draft") return;
    if (restored.current === null) {
      const draft = takeDraft();
      restored.current = draft ? "draft" : "none";
      if (searchParams.get("subscribed")) {
        toast.success("You're subscribed. Approve your script to draw it.", { id: "subscribed" });
        router.replace(remixId ? `/create?from=${encodeURIComponent(remixId)}` : "/create");
      }
      if (draft) {
        setIdea(draft.idea);
        setSettings(draft.settings);
        if (draft.script) {
          setScript(draft.script);
          setBaseline(draft.baseline);
          setScriptKey(draft.scriptKey);
          setPhase("review");
        }
        return;
      }
    }
    if (!remixId) {
      // Read after mount (not in useState) so the server render and hydration agree.
      applyRememberedLanguage();
      return;
    }
    repo.getGeneration(remixId).then((found) => {
      if (!found) return applyRememberedLanguage();
      setIdea(found.generation.idea);
      // Unknown look IDs (e.g. hand-edited storage) are dropped to "Any".
      const s = { ...found.generation.settings, face: normalizeFace(found.generation.settings.face) };
      // Older comics may use a panel count that's disabled while testing.
      const allowed = (PANEL_COUNTS as readonly number[]).includes(s.panelCount);
      // Legacy comics have no language (English); unknown IDs also fall back to English.
      setSettings({
        ...(allowed ? s : { ...s, panelCount: 4 }),
        language: getLanguage(s.language).id,
        reviewScript: s.reviewScript ?? s.enhance,
      });
    });
    // Runs once per remix id; searchParams/router are read only on that run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * F-019: drawing needs a plan with enough images left (character + panels).
   * Opens the paywall and returns false if not. The image API enforces this too.
   */
  async function ensureCanDraw(withScript: Script | null): Promise<boolean> {
    if (!billingEnabled) return true;
    const needed = settings.panelCount + 1;
    try {
      const status = await getBillingStatus();
      if (!status.required) return true;
      if (!status.entitled) {
        setPaywall({
          open: true,
          checkoutAvailable: status.checkoutAvailable,
          onHold: status.status === "on_hold" && status.canManage,
        });
      } else if (imagesLeft(status) >= needed) {
        return true;
      } else {
        toast.error(
          `This comic needs ${needed} images and you have ${imagesLeft(status)} left this billing period. ` +
            "Try fewer panels, or wait for your plan to renew."
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
    // Leave the script on screen so nothing is lost.
    setPhase(withScript ? "review" : "idle");
    return false;
  }

  async function draw(withScript: Script | null) {
    if (!(await ensureCanDraw(withScript))) return;
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

  const reviewOn = settings.reviewScript ?? settings.enhance;
  /** The script differs from the version last produced by writeScript/basicScript. */
  const edited = !!script && !!baseline && JSON.stringify(script) !== JSON.stringify(baseline);

  function clearResult() {
    setPanels([]);
    setCharacter({ status: "idle" });
    setGenerationId(null);
  }

  function forgetScript() {
    setScript(null);
    setBaseline(null);
    setScriptKey(null);
    setScriptErrors({});
  }

  /**
   * A fresh script: written by Claude (Enhance on) or built locally from the idea
   * (Enhance off, no AI call). Returns null if writing failed; the old script is kept.
   */
  async function produceScript(): Promise<Script | null> {
    clearResult();
    setScriptErrors({});
    let next: Script;
    if (settings.enhance) {
      setPhase("scripting");
      try {
        next = await ai.writeScript(idea, settings);
      } catch (err) {
        toast.error(errorMessage(err));
        setPhase("idle");
        return null;
      }
    } else {
      next = basicScript(idea, settings);
    }
    setScript(next);
    setBaseline(next);
    setScriptKey(scriptKeyFor(idea, settings));
    return next;
  }

  /** Validates, then draws the trimmed script. On errors, opens review with them inline. */
  async function approve(withScript: Script) {
    const errors = validateScript(withScript, idea);
    if (Object.keys(errors).length) {
      setScriptErrors(errors);
      setFocusToken((t) => t + 1);
      setPhase("review");
      return;
    }
    setScriptErrors({});
    const final = finalizeScript(withScript, idea);
    setScript(final);
    await draw(final);
  }

  /** Review on: open review. Review off: draw straight away. */
  async function proceed(withScript: Script) {
    if (!reviewOn) return approve(withScript);
    clearResult();
    setScriptErrors({});
    setPhase("review");
  }

  /** Runs `action` now, or after the Replace confirm if the script has edits. */
  function confirmReplace(action: () => void) {
    if (edited) setPendingReplace(() => action);
    else action();
  }

  async function handlePrimary() {
    const problem = checkIdea(idea);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (phase === "review") {
      if (script) await approve(script);
      return;
    }
    if (!settings.enhance && !reviewOn) {
      forgetScript();
      await draw(null);
      return;
    }
    // A kept script is reused when it was made for this idea, panel count and Enhance:
    // always with review on, and with review off only if the user edited it.
    const keyMatches = !!script && scriptKey === scriptKeyFor(idea, settings);
    if (script && keyMatches && (reviewOn || edited)) {
      await proceed(script);
      return;
    }
    confirmReplace(async () => {
      const next = await produceScript();
      if (next) await proceed(next);
    });
  }

  function handleRewrite() {
    confirmReplace(async () => {
      if (await produceScript()) setPhase("review");
    });
  }

  function backToSettings() {
    setScriptErrors({});
    setPhase("idle");
  }

  /** Edits clear that field's error. */
  function editScript(next: Script) {
    if (script && Object.keys(scriptErrors).length) {
      const changed = (path: string, a: string, b: string) => (a !== b ? [path] : []);
      const paths = [
        ...changed("title", script.title, next.title),
        ...changed("characters", script.characters, next.characters),
        ...next.panels.flatMap((p, i) => [
          ...changed(`panels.${i}.scene`, script.panels[i]?.scene ?? "", p.scene),
          ...changed(`panels.${i}.caption`, script.panels[i]?.caption ?? "", p.caption),
        ]),
      ];
      if (paths.some((p) => scriptErrors[p]))
        setScriptErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !paths.includes(k))));
    }
    setScript(next);
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
      await downloadComicPage(current.generation.title, current.images, { lang: current.generation.settings.language });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  function startOver() {
    setPhase("idle");
    forgetScript();
    setPanels([]);
    setCharacter({ status: "idle" });
    setGenerationId(null);
  }

  const approveLabel = `Approve and draw ${settings.panelCount} panels · ≈${formatCost(
    estimateCost(settings.quality, settings.panelCount)
  )}`;
  const primaryLabel =
    phase === "scripting"
      ? "Writing script…"
      : phase === "drawing"
        ? "Drawing panels…"
        : phase === "review"
          ? approveLabel
          : reviewOn
            ? settings.enhance
              ? "Write script"
              : "Review script"
            : `Generate ${settings.panelCount} ${settings.panelCount === 1 ? "image" : "images"}`;

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
                <Button variant="ghost" onClick={backToSettings}>
                  <Pencil /> Back to settings
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
            <ScriptEditor
              script={script}
              onChange={editScript}
              readOnly={phase !== "review"}
              sourceLabel={
                phase === "review"
                  ? settings.enhance
                    ? "Drafted by Claude. Edit anything before drawing."
                    : "Built from your prompt. Edit anything before drawing."
                  : settings.enhance
                    ? "Written by Claude"
                    : "Written from your prompt"
              }
              note={phase === "idle" ? "Your edited script is kept." : undefined}
              errors={scriptErrors}
              focusToken={focusToken}
              onApprove={handlePrimary}
              onBack={backToSettings}
              onRewrite={settings.enhance ? handleRewrite : undefined}
              approveLabel={approveLabel}
            />
          )}

          <PaywallDialog
            open={paywall.open}
            onOpenChange={(open) => setPaywall((p) => ({ ...p, open }))}
            imagesNeeded={settings.panelCount + 1}
            checkoutAvailable={paywall.checkoutAvailable}
            onHold={paywall.onHold}
            onBeforeCheckout={() => saveDraft({ idea, settings, script, baseline, scriptKey })}
          />

          <AlertDialog open={!!pendingReplace} onOpenChange={(open) => !open && setPendingReplace(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace your edited script?</AlertDialogTitle>
                <AlertDialogDescription>Your changes to the script will be lost.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const action = pendingReplace;
                    setPendingReplace(null);
                    action?.();
                  }}
                >
                  Replace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
                      lang={current?.generation.settings.language ?? settings.language}
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
