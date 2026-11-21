"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, ImageIcon, MoreHorizontal, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GenerationWithImages } from "@/lib/data";
import { downloadComicPage } from "@/lib/download";
import { formatRelativeDate } from "@/lib/format";
import { getStyle } from "@/lib/presets";
import { DeleteGenerationDialog } from "./delete-dialog";

export function Thumbnail({ item, className }: { item: GenerationWithImages; className?: string }) {
  const shown = item.images.slice(0, 4);
  if (!shown.length)
    return (
      <div className={`flex items-center justify-center bg-muted ${className ?? ""}`}>
        <ImageIcon className="size-6 text-chart-4" aria-hidden />
      </div>
    );
  return (
    <div className={`grid gap-0.5 bg-muted ${shown.length > 1 ? "grid-cols-2" : ""} ${className ?? ""}`}>
      {shown.map((img, i) => (
        <img
          key={img.id}
          src={img.url}
          alt=""
          className={`size-full object-cover ${shown.length === 3 && i === 0 ? "row-span-2" : ""}`}
        />
      ))}
    </div>
  );
}

export function GenerationCard({ item }: { item: GenerationWithImages }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { generation, images } = item;
  const href = `/library/${generation.id}`;

  async function download() {
    try {
      await downloadComicPage(generation.title, images);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      <Link href={href} aria-label={`Open ${generation.title}`} className="block">
        <Thumbnail item={item} className="aspect-[4/3]" />
      </Link>
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-3.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href={href} className="truncate font-medium hover:underline">
            {generation.title}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
              {getStyle(generation.settings.style).name}
            </span>
            <span>
              {images.length} {images.length === 1 ? "image" : "images"} · {formatRelativeDate(generation.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={download} disabled={!images.length}>
            <Download className="text-muted-foreground" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/create?from=${generation.id}`)}>
                <Shuffle /> Remix
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DeleteGenerationDialog
        generationId={generation.id}
        title={generation.title}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </article>
  );
}
