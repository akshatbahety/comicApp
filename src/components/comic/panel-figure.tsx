"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CAPTION_FONT_STACK, getLanguage, panelColumns, type LanguageId } from "@/lib/presets";
import type { PanelImage } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PanelState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; image: PanelImage };

interface PanelFigureProps {
  index: number;
  state: PanelState;
  aspect: string; // CSS aspect-ratio, e.g. "1 / 1"
  caption?: string;
  /** Caption language: sets the figcaption's `lang` for fonts and screen readers. Defaults to English. */
  lang?: LanguageId;
  regenerating?: boolean;
  onRegenerate?: () => void;
}

export function PanelFigure({ index, state, aspect, caption, lang, regenerating, onRegenerate }: PanelFigureProps) {
  const busy = state.status === "loading" || regenerating;
  return (
    <figure
      className="relative m-0 overflow-hidden rounded-xl bg-muted"
      style={{ aspectRatio: aspect }}
      aria-busy={busy || undefined}
    >
      {state.status === "done" && (
        <img
          src={state.image.url}
          alt={`Panel ${index + 1}${caption ? `: ${caption}` : ""}`}
          className={cn("size-full object-cover transition-opacity", regenerating && "opacity-40")}
        />
      )}
      {state.status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="absolute inset-0 rounded-none" />
          <span className="relative text-xs font-medium text-muted-foreground">Drawing panel {index + 1}…</span>
        </div>
      )}
      {state.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <AlertCircle className="size-5 text-destructive" aria-hidden />
          {state.error}
        </div>
      )}
      {regenerating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <RefreshCw className="size-6 animate-spin text-foreground" aria-hidden />
        </div>
      )}

      <span className="absolute top-2.5 left-2.5 rounded-full bg-card px-2 py-0.5 font-mono text-[11px] font-semibold">
        {index + 1}
      </span>

      {onRegenerate && state.status !== "loading" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="secondary"
              className="absolute top-1.5 right-1.5 bg-card/95 hover:bg-card"
              onClick={onRegenerate}
              disabled={regenerating}
              aria-label={`Regenerate panel ${index + 1}`}
            >
              <RefreshCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Regenerate this panel</TooltipContent>
        </Tooltip>
      )}

      {caption && state.status === "done" && (
        <figcaption
          lang={getLanguage(lang).lang}
          style={{ fontFamily: CAPTION_FONT_STACK }}
          className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-card/95 px-3 py-2 text-xs leading-snug break-words text-card-foreground shadow-sm sm:text-[13px]"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function ComicGrid({ count, children }: { count: number; children: React.ReactNode }) {
  const cols = panelColumns(count);
  return (
    <div
      className={cn(
        "grid gap-2.5",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-2 lg:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}

export const cssAspect = (ratio: string) => ratio.replace(":", " / ");
