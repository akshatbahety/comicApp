"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Script } from "@/lib/types";

interface ScriptEditorProps {
  script: Script;
  onChange?: (script: Script) => void;
  readOnly?: boolean;
}

export function ScriptEditor({ script, onChange, readOnly }: ScriptEditorProps) {
  const update = (i: number, patch: Partial<Script["panels"][number]>) =>
    onChange?.({ ...script, panels: script.panels.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Script</CardTitle>
          <CardDescription className="mt-1">
            {readOnly ? "Written by Claude" : "Drafted by Claude. Edit anything before drawing."}
          </CardDescription>
        </div>
        <Badge className="bg-plum-soft text-plum-soft-foreground">{script.panels.length} panels</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!readOnly && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="script-title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="script-title"
              value={script.title}
              onChange={(e) => onChange?.({ ...script, title: e.target.value })}
            />
          </div>
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
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Textarea
                    aria-label={`Panel ${i + 1} scene`}
                    value={p.scene}
                    onChange={(e) => update(i, { scene: e.target.value })}
                    className="min-h-14 text-sm"
                  />
                  <Input
                    aria-label={`Panel ${i + 1} caption`}
                    value={p.caption}
                    placeholder="Caption or dialogue (optional)"
                    onChange={(e) => update(i, { caption: e.target.value })}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
