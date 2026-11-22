"use client";

import { useEffect } from "react";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SCRIPT_LIMITS } from "@/lib/presets";
import type { Script } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
  script: Script;
  onChange?: (script: Script) => void;
  readOnly?: boolean;
  /** Card description, e.g. "Written by Claude" or "Written from your prompt". */
  sourceLabel?: string;
  /** Extra line under the description, e.g. "Your edited script is kept." */
  note?: string;
  /** Validation errors by field path: `title`, `characters`, `panels.N.scene`, `panels.N.caption`. */
  errors?: Record<string, string>;
  /** Bump after a failed approve to move focus to the first invalid field. */
  focusToken?: number;
  /** Footer actions (editable mode only). The footer renders when `onApprove` is set. */
  onApprove?: () => void;
  onBack?: () => void;
  onRewrite?: () => void;
  approveLabel?: string;
}

/** DOM id for a field path, used for labels, error messages and focusing the first invalid field. */
const fieldId = (path: string) => `script-${path.replace(/\./g, "-")}`;

/** Field order, so focus goes to the first invalid one. */
const fieldOrder = (script: Script) => [
  "title",
  "characters",
  ...script.panels.flatMap((_, i) => [`panels.${i}.scene`, `panels.${i}.caption`]),
];

function Counter({ value, max }: { value: string; max: number }) {
  if (value.length < max - 20) return null;
  return (
    <span className={cn("font-mono text-xs", value.length >= max ? "text-destructive" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

function FieldError({ path, errors }: { path: string; errors?: Record<string, string> }) {
  const message = errors?.[path];
  if (!message) return null;
  return (
    <p id={`${fieldId(path)}-error`} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/** Props that wire a field to its error state. */
const errorProps = (path: string, errors?: Record<string, string>) => ({
  id: fieldId(path),
  "aria-invalid": errors?.[path] ? true : undefined,
  "aria-describedby": errors?.[path] ? `${fieldId(path)}-error` : undefined,
});

export function ScriptEditor({
  script,
  onChange,
  readOnly,
  sourceLabel,
  note,
  errors,
  focusToken,
  onApprove,
  onBack,
  onRewrite,
  approveLabel,
}: ScriptEditorProps) {
  const update = (i: number, patch: Partial<Script["panels"][number]>) =>
    onChange?.({ ...script, panels: script.panels.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  // Move focus to the first invalid field each time a failed approve bumps `focusToken`.
  useEffect(() => {
    if (readOnly || !errors || !focusToken) return;
    const first = fieldOrder(script).find((path) => errors[path]);
    if (first) document.getElementById(fieldId(first))?.focus();
    // Only on a new failed approve, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, readOnly]);

  const description = sourceLabel ?? (readOnly ? "Written by Claude" : "Edit anything before drawing.");

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Script</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
          {note && <p className="mt-1 text-xs font-medium text-primary">{note}</p>}
        </div>
        <Badge className="bg-plum-soft text-plum-soft-foreground">{script.panels.length} panels</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {readOnly ? (
          <div className="flex flex-col gap-1 text-sm">
            {script.title && <p className="font-semibold">{script.title}</p>}
            {script.characters && (
              <p>
                <span className="font-medium">Main character:</span>{" "}
                <span className="text-muted-foreground">{script.characters}</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={fieldId("title")} className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Counter value={script.title} max={SCRIPT_LIMITS.title} />
              </div>
              <Input
                {...errorProps("title", errors)}
                value={script.title}
                maxLength={SCRIPT_LIMITS.title}
                onChange={(e) => onChange?.({ ...script, title: e.target.value })}
              />
              <FieldError path="title" errors={errors} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={fieldId("characters")} className="text-xs font-medium text-muted-foreground">
                  Main character
                </label>
                <Counter value={script.characters} max={SCRIPT_LIMITS.characters} />
              </div>
              <Textarea
                {...errorProps("characters", errors)}
                value={script.characters}
                maxLength={SCRIPT_LIMITS.characters}
                onChange={(e) => onChange?.({ ...script, characters: e.target.value })}
                className="min-h-14 text-sm"
              />
              <p className="text-xs text-muted-foreground">Used to design the reference character</p>
              <FieldError path="characters" errors={errors} />
            </div>
          </>
        )}
        <ol className="flex flex-col">
          {script.panels.map((p, i) => (
            <li key={i} className="flex gap-3 border-t py-3 first:border-t-0 first:pt-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold">
                {i + 1}
              </span>
              {readOnly ? (
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <span>{p.scene}</span>
                  {p.caption && <span className="text-muted-foreground">“{p.caption}”</span>}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={fieldId(`panels.${i}.scene`)} className="text-xs font-medium text-muted-foreground">
                      Scene
                    </label>
                    <Counter value={p.scene} max={SCRIPT_LIMITS.scene} />
                  </div>
                  <Textarea
                    {...errorProps(`panels.${i}.scene`, errors)}
                    value={p.scene}
                    maxLength={SCRIPT_LIMITS.scene}
                    onChange={(e) => update(i, { scene: e.target.value })}
                    className="min-h-14 text-sm"
                  />
                  <FieldError path={`panels.${i}.scene`} errors={errors} />
                  <div className="mt-1 flex items-center justify-between">
                    <label
                      htmlFor={fieldId(`panels.${i}.caption`)}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Caption or dialogue
                    </label>
                    <Counter value={p.caption} max={SCRIPT_LIMITS.caption} />
                  </div>
                  <Input
                    {...errorProps(`panels.${i}.caption`, errors)}
                    value={p.caption}
                    maxLength={SCRIPT_LIMITS.caption}
                    placeholder="Optional"
                    onChange={(e) => update(i, { caption: e.target.value })}
                  />
                  <FieldError path={`panels.${i}.caption`} errors={errors} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
      {!readOnly && onApprove && (
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t">
          {onBack && (
            <Button variant="ghost" onClick={onBack} className="mr-auto">
              <ArrowLeft /> Back to settings
            </Button>
          )}
          {onRewrite && (
            <Button variant="outline" onClick={onRewrite}>
              <RefreshCw /> Rewrite script
            </Button>
          )}
          <Button onClick={onApprove}>
            <Sparkles /> {approveLabel ?? "Approve and draw"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
