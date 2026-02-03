// app/payment/customer-portal.tsx
"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function CustomerPortal({ customerId: customerIdProp }: { customerId?: string }) {
  const { data: userSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerId = customerIdProp || (userSession?.user as { customerId?: string })?.customerId;

  const handleOpenPortal = async (customerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/payment/dodo/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: customerId }),
      });

      if (!response.ok) {
        let errMsg = `Customer portal request failed (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody && errBody.message) errMsg = String(errBody.message);
          else errMsg = JSON.stringify(errBody);
        } catch {
          try {
            const txt = await response.text();
            if (txt) errMsg = txt;
          } catch {
            // ignore
          }
        }
        console.error('Error opening customer portal:', errMsg);
        setError(errMsg || 'Could not open customer portal.');
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data && data.portal_url) {
        window.open(data.portal_url, '_blank');
      } else {
        setError('Could not open customer portal.');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      setError('An error occurred while trying to open the customer portal.');
    }
    setLoading(false);
  };

  const isDisabled = !customerId || loading;

  return (
    <div>
      <button
        onClick={() => customerId && handleOpenPortal(customerId)}
        disabled={isDisabled}
        className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
      >
        {loading ? 'Opening...' : 'Manage Subscription'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
      {!customerId && (
        <p className="text-sm text-gray-600">Customer portal unavailable: missing customer ID.</p>
      )}
    </div>
  );
}