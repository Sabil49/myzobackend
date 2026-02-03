// app/payment/checkout.tsx
"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function SubscribeButton({ planId }: { planId?: string }) {
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { data: userSession } = useSession();
  const email = userSession?.user?.email;

  const createCheckoutSession = async () => {
    setLoading(true);
    setError(null);
    console.log('Creating checkout session for plan:', planId);
    try {
      if (!userSession) {
        setError('You must be signed in to proceed to checkout.');
        setLoading(false);
        return;
      }

      if (!email) {
        setError('Your account is missing an email address. Please verify your profile.');
        setLoading(false);
        return;
      }

      if (!planId) {
        setError('No plan selected for checkout.');
        setLoading(false);
        return;
      }
    const customer = {
      email: email
    };

    const response = await fetch('/api/payment/dodo/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: planId,
            quantity: 1
          }
        ],        
        customer,
      })
    });

    if (!response.ok) {
      console.log(response);
      setError('Failed to create checkout session: ' + response.statusText);
      setLoading(false);
      return;
    }

    const checkoutSession = await response.json();
    
    console.log('Checkout Session:===========>');
    console.log(checkoutSession);
    console.log('Checkout URL:', checkoutSession.checkout_url);

    if (checkoutSession && checkoutSession.checkout_url) {
      window.location.href = checkoutSession.checkout_url;      
      return checkoutSession;
    }
    
  } catch (error) {
    setError('An error occurred while creating checkout session: ' + (error instanceof Error ? error.message : ''));
    setLoading(false);
    return null;
    }
}

  if (!userSession) {
    return null;
  }

  return (
    <div>
      <button
        onClick={createCheckoutSession}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Subscribe Now
      </button>
      
      <div>{loading && <p>Loading...</p>}</div>
      <div>{error && <p className="text-red-500">{error}</p>}</div>
    </div>
  );
}