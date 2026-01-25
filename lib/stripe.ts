// lib/stripe.ts

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not defined');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});