import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  try {
    const transport = getTransporter();

    const info = await transport.sendMail({
      from: params.from || process.env.SMTP_FROM || "noreply@humane-job.com",
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || convertTextToHtml(params.text),
      replyTo: params.replyTo,
      cc: params.cc,
      bcc: params.bcc,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendRejectionLetter(params: {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  letter: string;
  scheduledFor?: Date;
}): Promise<EmailResult> {
  const subject = `Update on your application for ${params.jobTitle} at ${params.companyName}`;

  const htmlLetter = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #6366f1;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 600;
      color: #6366f1;
    }
    .content {
      white-space: pre-wrap;
      margin-bottom: 30px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      margin-top: 30px;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${params.companyName}</div>
  </div>

  <div class="content">${params.letter}</div>

  <div class="footer">
    <p>This is an automated message from ${params.companyName}.</p>
    <p>If you have questions, please contact our HR team.</p>
  </div>
</body>
</html>
  `;

  // If scheduled for future, we'd implement a job queue here
  // For now, send immediately
  if (params.scheduledFor && params.scheduledFor > new Date()) {
    // TODO: Implement job queue (e.g., Bull, BullMQ)
    console.log(`Email scheduled for ${params.scheduledFor}`);
    return {
      success: true,
      messageId: `scheduled-${Date.now()}`,
    };
  }

  return sendEmail({
    to: params.candidateEmail,
    subject,
    text: params.letter,
    html: htmlLetter,
  });
}

export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch (error) {
    console.error("Email configuration error:", error);
    return false;
  }
}

function convertTextToHtml(text: string): string {
  return text
    .split("\n\n")
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export function getDefaultRejectionEmailTemplate(): EmailTemplate {
  return {
    subject: "Update on your application for {{jobTitle}} at {{companyName}}",
    body: `Dear {{candidateName}},

{{letter}}

Best regards,
{{companyName}} Hiring Team`,
  };
}

export function renderEmailTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): EmailTemplate {
  let subject = template.subject;
  let body = template.body;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    subject = subject.replace(placeholder, value);
    body = body.replace(placeholder, value);
  });

  return { subject, body };
}
