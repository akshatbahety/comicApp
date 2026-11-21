import { Suspense } from "react";
import { DetailSkeleton, DetailView } from "./detail-view";

async function Detail({ params }: { params: PageProps<"/library/[id]">["params"] }) {
  const { id } = await params;
  return <DetailView id={id} />;
}

export default function GenerationPage({ params }: PageProps<"/library/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}
