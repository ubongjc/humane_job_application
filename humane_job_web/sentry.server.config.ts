import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",

  beforeSend(event, hint) {
    // Don't send certain errors in development
    if (process.env.NODE_ENV === "development") {
      console.error("Sentry Event:", event);
      console.error("Original Exception:", hint?.originalException);
    }

    // Filter out expected errors
    const error = hint?.originalException;
    if (error instanceof Error) {
      // Don't send rate limit errors
      if (error.message.includes("Rate limit")) {
        return null;
      }
    }

    return event;
  },
});
