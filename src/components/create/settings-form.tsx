"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ASPECT_RATIOS,
  COLOR_MODES,
  MAX_IDEA_LENGTH,
  PANEL_COUNTS,
  QUALITIES,
  STYLES,
  getQuality,
  TONES,
  type AspectRatioId,
  type ColorModeId,
  type StyleId,
  type ToneId,
} from "@/lib/presets";
import type { GenerationSettings, PanelCount } from "@/lib/types";
import { cn } from "@/lib/utils";

const IDEAS = [
  "A cat detective solves the mystery of the missing fish at the harbour.",
  "A shy robot enters a baking competition and accidentally invents a new cake.",
  "Two rival wizards are forced to share a tiny apartment.",
  "An astronaut discovers the moon has a lost-and-found office.",
  "A grandmother becomes the town's most feared skateboarder.",
];

interface SettingsFormProps {
  idea: string;
  onIdeaChange: (v: string) => void;
  settings: GenerationSettings;
  onChange: (patch: Partial<GenerationSettings>) => void;
  disabled?: boolean;
}

export function SettingsForm({ idea, onIdeaChange, settings, onChange, disabled }: SettingsFormProps) {
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-6 disabled:opacity-70">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="idea">Prompt</Label>
          <span className="font-mono text-xs text-muted-foreground">
            {idea.length}/{MAX_IDEA_LENGTH}
          </span>
        </div>
        <Textarea
          id="idea"
          value={idea}
          maxLength={MAX_IDEA_LENGTH}
          onChange={(e) => onIdeaChange(e.target.value)}
          placeholder="Describe a scene or a short story…"
          className="min-h-28 resize-y leading-relaxed"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="h-8 rounded-full border bg-card px-3 text-xs font-medium hover:bg-accent"
            onClick={() => {
              const pool = IDEAS.filter((i) => i !== idea);
              onIdeaChange(pool[Math.floor(Math.random() * pool.length)]);
            }}
          >
            Surprise me
          </button>
          <button
            type="button"
            className="h-8 rounded-full border bg-card px-3 text-xs font-medium hover:bg-accent"
            onClick={() => onIdeaChange(`${idea.trim().replace(/\.$/, "")}, but with an unexpected twist at the end.`)}
            disabled={!idea.trim()}
          >
            Add a twist
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-background px-3.5 py-3">
        <div>
          <Label htmlFor="enhance">Enhance with Claude</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Writes a script and a prompt for each panel</p>
        </div>
        <Switch id="enhance" checked={settings.enhance} onCheckedChange={(enhance) => onChange({ enhance })} />
      </div>

      <div className="flex flex-col gap-2">
        <Label id="quality-label">Quality</Label>
        <div role="radiogroup" aria-labelledby="quality-label" className="grid grid-cols-3 gap-2">
          {QUALITIES.map((q) => {
            const selected = getQuality(settings.quality).id === q.id;
            return (
              <button
                key={q.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ quality: q.id })}
                title={`${q.modelName} · ${q.hint}`}
                className={cn(
                  "flex min-w-0 flex-col rounded-lg border bg-card px-2.5 py-2 text-left transition-shadow",
                  selected ? "border-primary ring-3 ring-primary/15" : "hover:border-input"
                )}
              >
                <span className="text-sm font-medium">{q.name}</span>
                <span className="font-mono text-xs text-muted-foreground">~${q.panelCost}/panel</span>
                <span className="truncate text-xs text-muted-foreground">{q.modelName}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{getQuality(settings.quality).hint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="style-label">Style</Label>
        <div role="radiogroup" aria-labelledby="style-label" className="grid grid-cols-2 gap-2">
          {STYLES.map((s) => {
            const selected = settings.style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ style: s.id as StyleId })}
                className={cn(
                  "flex min-h-13 items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-shadow",
                  selected ? "border-primary ring-3 ring-primary/15" : "hover:border-input"
                )}
              >
                <span className="grid size-7 shrink-0 grid-cols-2 overflow-hidden rounded-md" aria-hidden>
                  {s.palette.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="layout-label">Panels</Label>
        <ToggleGroup
          type="single"
          aria-labelledby="layout-label"
          value={String(settings.panelCount)}
          onValueChange={(v) => v && onChange({ panelCount: Number(v) as PanelCount })}
          variant="outline"
          className="w-full"
        >
          {PANEL_COUNTS.map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="flex-1 data-[state=on]:bg-foreground data-[state=on]:text-background">
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="aspect">Aspect ratio</Label>
          <Select value={settings.aspectRatio} onValueChange={(v) => onChange({ aspectRatio: v as AspectRatioId })}>
            <SelectTrigger id="aspect" className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="colour">Colour</Label>
          <Select value={settings.colorMode} onValueChange={(v) => onChange({ colorMode: v as ColorModeId })}>
            <SelectTrigger id="colour" className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_MODES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="tone-label">Tone</Label>
        <div role="radiogroup" aria-labelledby="tone-label" className="flex flex-wrap gap-1.5">
          {TONES.map((t) => {
            const selected = settings.tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ tone: t.id as ToneId })}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent"
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
