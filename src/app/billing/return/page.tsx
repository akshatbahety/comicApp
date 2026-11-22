import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnView } from "./return-view";

export const metadata: Metadata = { title: "Confirming payment" };

export default function BillingReturnPage() {
  return (
    <Suspense>
      <ReturnView />
    </Suspense>
  );
}
