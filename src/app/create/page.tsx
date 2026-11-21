import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateView } from "./create-view";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <Suspense>
      <CreateView />
    </Suspense>
  );
}
