"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function CheckoutReturnPage() {
  function MyStatusComponent() {
    const params = useSearchParams();
    const status = params.get("status"); // "success" | "cancelled"

    return <div>{status === "success" ? (
        <h1 className="text-2xl font-bold text-green-600">✅ Subscription Successful</h1>
      ) : (
        <h1 className="text-2xl font-bold text-red-600">❌ Checkout Cancelled</h1>
      )}</div>;
      }
 

  return (
    <div className="p-8 text-center">
      <Suspense fallback={<div>Loading status...</div>}>
        <MyStatusComponent />
      </Suspense>
    </div>
  );
}
