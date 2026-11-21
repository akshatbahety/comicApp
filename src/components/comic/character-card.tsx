import { AlertCircle, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Character } from "@/lib/types";

export type CharacterState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; character: Character };

/** The reference character a comic's panels were drawn from. */
export function CharacterCard({ state }: { state: CharacterState }) {
  if (state.status === "idle") return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-2.5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-white">
        {state.status === "done" && (
          <img src={state.character.imageUrl} alt="Reference character" className="size-full object-contain" />
        )}
        {state.status === "loading" && <Skeleton className="absolute inset-0 rounded-none" />}
        {state.status === "error" && (
          <div className="flex size-full items-center justify-center bg-muted">
            <AlertCircle className="size-5 text-destructive" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <UserRound className="size-4 text-primary" aria-hidden />
          Reference character
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {state.status === "loading" && "Designing the character first. Every panel will be drawn from it…"}
          {state.status === "error" && state.error}
          {state.status === "done" && "Every panel is drawn from this image so the character stays consistent."}
        </p>
      </div>
    </div>
  );
}
