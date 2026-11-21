"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Thumbnail } from "@/components/library/generation-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repo, useRepoQuery } from "@/lib/data";
import { formatRelativeDate } from "@/lib/format";
import { getStyle } from "@/lib/presets";
import type { DailyActivity } from "@/lib/types";

export function DashboardView() {
  const statsQuery = useCallback((r: typeof repo) => r.getStats(), []);
  const recentQuery = useCallback((r: typeof repo) => r.listGenerations().then((l) => l.slice(0, 5)), []);
  const { data: stats, loading } = useRepoQuery(statsQuery);
  const { data: recent } = useRepoQuery(recentQuery);
  const [range, setRange] = useState<"7" | "14">("14");

  const newButton = (
    <Button asChild>
      <Link href="/create">
        <Plus /> New generation
      </Link>
    </Button>
  );

  if (loading || !stats) {
    return (
      <>
        <PageHeader title="Dashboard" description="An overview of what you've generated and saved." />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  if (stats.totalGenerations === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="An overview of what you've generated and saved." />
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <p className="text-lg font-semibold">Nothing generated yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Your generation and image counts, activity and recent work will show up here after your first generation.
          </p>
          <div className="mt-3">{newButton}</div>
        </div>
      </>
    );
  }

  const savedPct = stats.totalImages ? Math.round((stats.savedImages / stats.totalImages) * 100) : 0;
  const activity = range === "7" ? stats.activity.slice(-7) : stats.activity;
  const maxStyle = stats.imagesByStyle[0]?.count ?? 1;

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of what you've generated and saved." actions={newButton} />

      <div className="flex flex-col gap-4">
        <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <StatCard label="Generations" value={stats.totalGenerations} note={<><Delta n={stats.generationsThisWeek} /> this week</>} />
          <StatCard label="Images created" value={stats.totalImages} note={<><Delta n={stats.imagesThisWeek} /> this week</>} />
          <StatCard label="Saved images" value={stats.savedImages} note={`${savedPct}% of everything generated`} />
          <div className="rounded-xl border border-sidebar-primary bg-sidebar-primary p-5 text-sidebar-primary-foreground">
            <p className="text-sm font-medium text-sidebar-primary-foreground">Most used style</p>
            <p className="mt-2.5 mb-1.5 text-3xl font-semibold tracking-tight">
              {stats.topStyle ? getStyle(stats.topStyle.style).name : "—"}
            </p>
            <p className="text-[13px] text-sidebar-primary-foreground">
              {stats.topStyle ? `${stats.topStyle.count} of ${stats.totalGenerations} generations` : ""}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:flex-row">
          <Card className="min-w-0 flex-[2] gap-4 py-5">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription className="mt-1">Generations and images per day</CardDescription>
              </div>
              <Tabs value={range} onValueChange={(v) => setRange(v as "7" | "14")}>
                <TabsList>
                  <TabsTrigger value="7">7 days</TabsTrigger>
                  <TabsTrigger value="14">14 days</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="px-5">
              <ActivityChart data={activity} />
            </CardContent>
          </Card>

          <Card className="min-w-0 flex-1 gap-4 py-5">
            <CardHeader className="px-5">
              <CardTitle>Images by style</CardTitle>
              <CardDescription>All time</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 px-5">
              {stats.imagesByStyle.map(({ style, count }) => (
                <div key={style} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium">{getStyle(style).name}</span>
                    <span className="font-mono text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(count / maxStyle) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent generations</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your last five runs, saved or not</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/library">View library</Link>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Title</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="px-5 text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent ?? []).map((item) => {
                const g = item.generation;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="px-5">
                      <Link href={`/library/${g.id}`} className="flex items-center gap-3 font-medium hover:underline">
                        <Thumbnail item={item} className="size-9 shrink-0 overflow-hidden rounded-lg" />
                        {g.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getStyle(g.settings.style).name}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{item.images.length}</TableCell>
                    <TableCell>
                      {g.status === "pending" ? (
                        <Badge variant="outline">Generating</Badge>
                      ) : g.status === "failed" ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : g.saved ? (
                        <Badge className="bg-plum-soft text-plum-soft-foreground">Saved</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-5 text-right text-muted-foreground">{formatRelativeDate(g.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, value, note }: { label: string; value: number; note: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2.5 mb-1.5 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
      <p className="text-[13px] text-muted-foreground">{note}</p>
    </div>
  );
}

function Delta({ n }: { n: number }) {
  return <span className="font-semibold text-primary">+{n}</span>;
}

function ActivityChart({ data }: { data: DailyActivity[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.generations, d.images)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-1" /> Generations
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-chart-2" /> Images
        </span>
      </div>
      <div role="img" aria-label="Bar chart of daily generations and images" className="flex h-52 items-end gap-1.5 border-b sm:gap-2">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex h-full flex-1 items-end justify-center gap-[3px]"
            title={`${d.date}: ${d.generations} generations, ${d.images} images`}
          >
            <div className="w-[38%] max-w-4 rounded-t-[4px] bg-chart-1" style={{ height: `${(d.generations / max) * 100}%` }} />
            <div className="w-[38%] max-w-4 rounded-t-[4px] bg-chart-2" style={{ height: `${(d.images / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 font-mono text-[11px] text-muted-foreground sm:gap-2" aria-hidden>
        {data.map((d) => (
          <span key={d.date} className="flex-1 text-center">
            {Number(d.date.slice(8))}
          </span>
        ))}
      </div>
    </div>
  );
}
