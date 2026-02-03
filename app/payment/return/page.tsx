"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function CheckoutReturnPage() {
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StatusDisplay() {
  const params = useSearchParams();
  const status = params.get("status");

  return (
    <div>
      {status === "success" ? (
        <h1 className="text-2xl font-bold text-green-600">✅ Subscription Successful</h1>
      ) : (
        <h1 className="text-2xl font-bold text-red-600">❌ Checkout Cancelled</h1>
      )}
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <div className="p-8 text-center">
      <Suspense fallback={<div>Loading status...</div>}>
        <StatusDisplay />
      </Suspense>
    </div>
  );
} 

  return (
    <div className="p-8 text-center">
      <Suspense fallback={<div>Loading status...</div>}>
        <MyStatusComponent />
      </Suspense>
    </div>
  );
}
