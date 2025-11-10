import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find the subscription
  const existingSub = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    include: { company: true },
  });

  if (!existingSub) {
    console.error("Subscription not found for customer:", customerId);
    return;
  }

  // Update subscription
  await db.subscription.update({
    where: { id: existingSub.id },
    data: {
      stripeSubscriptionId: subscription.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Log audit
  await db.auditLog.create({
    data: {
      companyId: existingSub.companyId,
      action: "subscription.updated",
      entityType: "Subscription",
      entityId: existingSub.id,
      metadata: {
        status: subscription.status,
        stripeSubscriptionId: subscription.id,
      },
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const existingSub = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSub) return;

  await db.subscription.update({
    where: { id: existingSub.id },
    data: {
      status: "CANCELED",
      tier: "FREE",
    },
  });

  await db.auditLog.create({
    data: {
      companyId: existingSub.companyId,
      action: "subscription.canceled",
      entityType: "Subscription",
      entityId: existingSub.id,
      metadata: { reason: "stripe_deleted" },
    },
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const sub = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!sub) return;

  await db.auditLog.create({
    data: {
      companyId: sub.companyId,
      action: "payment.succeeded",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: {
        amount: invoice.amount_paid,
        invoiceId: invoice.id,
      },
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const sub = await db.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!sub) return;

  await db.subscription.update({
    where: { id: sub.id },
    data: { status: "PAST_DUE" },
  });

  await db.auditLog.create({
    data: {
      companyId: sub.companyId,
      action: "payment.failed",
      entityType: "Subscription",
      entityId: sub.id,
      metadata: {
        attempt: invoice.attempt_count,
        invoiceId: invoice.id,
      },
    },
  });
}

function mapStripeStatus(status: string): "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "TRIAL" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "trialing":
      return "TRIAL";
    default:
      return "ACTIVE";
  }
}
