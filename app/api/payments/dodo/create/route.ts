import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const dodoPaymentSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().min(1),
  currency: z.string().length(3).default("USD"),
  customerEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // ---- AUTH ----
    // const authHeader = request.headers.get("authorization");
    // if (!authHeader?.startsWith("Bearer ")) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    //const token = authHeader.slice("Bearer ".length);
    //let payload;

    // try {
    //   payload = verifyAccessToken(token);
    // } catch {
    //   return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    // }

    // ---- VALIDATE BODY ----
    const body = await request.json();
    const validatedData = dodoPaymentSchema.parse(body);

    // ---- LOAD ORDER ----
    const order = await prisma.order.findUnique({
      where: { id: validatedData.orderId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // if (order.userId !== payload.userId) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    if (!order.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          error: "Order has already been paid",
          paymentId: order.paymentIntentId,
        },
        { status: 400 }
      );
    }

    const BASE_URL =
      process.env.NEXT_PUBLIC_BASE_URL || "https://myzobackend.vercel.app";

    const returnUrl = `${BASE_URL}/api/payments/dodo/return?orderId=${order.id}`;
    const webhookUrl = `${BASE_URL}/api/payments/dodo/webhook`;

    // ---- CREATE REAL DODO PAYMENT (CUSTOM TRANSACTION) ----
    const dodoResponse = await fetch(
      "https://api.dodopayments.com/v1/payments",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DODO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: validatedData.amount,
          currency: validatedData.currency,
          reference_id: order.id, // IMPORTANT for webhook mapping
          customer_email:
            validatedData.customerEmail || order.user.email,
          success_url: returnUrl,
          cancel_url: `${BASE_URL}/payment/cancel`,
          webhook_url: webhookUrl,
          metadata: {
            order_id: order.id,
            order_number: order.orderNumber,
            user_id: order.userId,
          },
        }),
      }
    );

    if (!dodoResponse.ok) {
      const text = await dodoResponse.text();
      console.error("Dodo error:", text);
      return NextResponse.json(
        { error: "Failed to create Dodo payment" },
        { status: 500 }
      );
    }

    const dodoData = await dodoResponse.json();

    // Save payment intent ID for later tracking
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentIntentId: dodoData.id,
        paymentStatus: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: dodoData.payment_url, // OPEN THIS IN EXPO
      paymentId: dodoData.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error("Dodo payment creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
