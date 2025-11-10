# Features Documentation

> **Comprehensive guide to all features in the Humane Job Application platform**

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Access Control](#authentication--access-control)
3. [Job Management](#job-management)
4. [Candidate Management](#candidate-management)
5. [AI-Powered Letter Generation](#ai-powered-letter-generation)
6. [Bias Detection & Fairness](#bias-detection--fairness)
7. [Email & Communication](#email--communication)
8. [Candidate Appeals](#candidate-appeals)
9. [Data Subject Rights (DSR)](#data-subject-rights-dsr)
10. [Security Features](#security-features)
11. [Audit & Compliance](#audit--compliance)
12. [Subscription & Billing](#subscription--billing)
13. [Template Management](#template-management)
14. [Browser Extension](#browser-extension)
15. [Analytics & Monitoring](#analytics--monitoring)
16. [UX Enhancements](#ux-enhancements)
17. [Internationalization](#internationalization)
18. [Additional Features](#additional-features)

---

## Overview

The Humane Job Application is a browser extension + HR web application that generates humane, privacy-safe candidate rejection letters with contextual feedback from interview notes and rubrics, protecting brand reputation and improving candidate experience.

**Key Differentiators:**
- Privacy-first: Never sends raw resumes to AI, only structured rubric scores
- Explainable AI with cryptographically-signed feedback cards
- Comprehensive bias detection across 11 protected categories
- Smart scheduling based on research
- One-click generation (< 3 seconds)
- Candidate appeals system with 7-day SLA
- Enterprise-grade security and compliance

---

## Authentication & Access Control

### WebAuthn/Passkeys First (FIDO2)
**What it is:** Passwordless authentication using biometrics or hardware keys.

**How to use:**
1. Navigate to login page
2. Click "Sign in with Passkey"
3. Use fingerprint, Face ID, or security key
4. Managed via Clerk authentication provider

### Magic Links
**What it is:** Email-based authentication fallback.

**How to use:**
1. Click "Sign in with Email"
2. Enter your email address
3. Check inbox for magic link (expires in 15 minutes)
4. Click link to authenticate

### Social OAuth
**What it is:** Sign in with Google or Microsoft accounts.

**How to use:**
1. Click "Continue with Google" or "Continue with Microsoft"
2. Authorize access
3. Redirected to dashboard

### Multi-Factor Authentication (MFA)
**What it is:** Additional security layer with TOTP or SMS.

**How to use:**
1. Go to Account Settings > Security
2. Enable MFA
3. Choose TOTP (authenticator app) or SMS
4. Scan QR code or enter phone number
5. Save backup codes

### Role-Based Access Control (RBAC)
**What it is:** Four distinct user roles with different permissions.

**Roles:**
- **Admin**: Full access to company settings, feature flags, billing, user management
- **Hiring Manager**: Create jobs, view all candidates, generate/send letters, manage templates
- **Recruiter**: View assigned jobs, add candidates, create interview notes
- **Interviewer**: View assigned candidates, submit interview notes (read-only otherwise)

**How to use:**
1. Admins: Go to Settings > Team Members
2. Click "Invite Member"
3. Enter email and select role
4. User receives invitation email

---

## Job Management

### Job Posting Creation
**What it is:** Create and manage job postings with custom evaluation criteria.

**How to use:**
1. Navigate to Jobs > New Job
2. Fill in job details:
   - Title (e.g., "Senior Software Engineer")
   - Description
   - Department
   - Location
   - Jurisdiction (US/EU/CA)
3. Click "Create Job"

### Custom Rubrics
**What it is:** Define evaluation criteria with weights and descriptions.

**How to use:**
1. In job creation/edit form, go to "Rubrics" section
2. Add criteria (e.g., "Technical Skills", "Communication")
3. Set weight (0-100, should total 100)
4. Add description
5. Define passing threshold
6. Save rubric

**Example rubric:**
```
- Technical Skills (40%): Proficiency in required technologies
- Communication (30%): Clarity and professionalism
- Cultural Alignment (20%): Values match
- Problem Solving (10%): Analytical thinking
```

### Job Status Management
**What it is:** Control job posting visibility and candidate flow.

**Statuses:**
- **DRAFT**: Not visible, still being configured
- **ACTIVE**: Accepting applications
- **PAUSED**: Temporarily closed, can reopen
- **CLOSED**: Permanently closed, no new candidates

**How to use:**
1. Go to Jobs > Select job
2. Click status dropdown
3. Select new status
4. Confirm change

### Job Analytics
**What it is:** Track candidate metrics and decision patterns.

**How to use:**
1. Go to Jobs > Select job > Analytics tab
2. View metrics:
   - Total candidates
   - Decision breakdown (accepted, rejected, pending)
   - Time-to-decision average
   - Bias score trends

---

## Candidate Management

### Candidate Tracking
**What it is:** Email-based candidate identification and management.

**How to use:**
1. Go to Candidates > Add Candidate
2. Enter required information:
   - Email (unique identifier)
   - Name
   - Job posting
   - Source (e.g., LinkedIn, Indeed, Referral)
3. Click "Save"

### Resume Storage
**What it is:** Secure S3-compatible storage (Cloudflare R2) with time-limited access.

**How to use:**
1. In candidate form, click "Upload Resume"
2. Select PDF file (max 5MB)
3. File automatically uploaded to secure storage
4. Access via pre-signed URL (15-minute expiration)
5. Download from candidate profile when needed

### Privacy & Consent Management
**What it is:** Track candidate consent for data processing.

**How to use:**
1. In candidate profile, go to "Privacy" tab
2. Record consent flags:
   - Data processing consent
   - Marketing communications consent
   - Data retention period
3. Update as needed
4. Consent history is audit-logged

### Batch Operations
**What it is:** Import/export candidates via CSV.

**CSV Import:**
1. Go to Candidates > Import
2. Download CSV template
3. Fill in candidate data
4. Upload CSV file
5. Review mapping
6. Confirm import

**CSV Export:**
1. Go to Candidates > Export
2. Select filter (all, by job, by status)
3. Click "Export to CSV"
4. Download file

### Data Minimization
**What it is:** Only structured rubric data sent to AI, never raw resumes.

**How it works:**
- Interviewers fill out rubric scores (1-10)
- AI receives only: rubric name, score, weight, notes
- Raw resume PDF never sent to AI
- Protects PII and sensitive information

---

## AI-Powered Letter Generation

### Standard Generation
**What it is:** AI-generated rejection letters with contextual feedback.

**How to use:**
1. Go to Candidate Profile
2. Navigate to "Decision" tab
3. Click "Generate Letter"
4. Configure settings:
   - Tone: Formal, Friendly, Empathetic
   - Include feedback: Yes/No
   - Jurisdiction: US/EU/CA (auto-detected from job)
5. Click "Generate"
6. Review generated letter
7. Edit if needed
8. Save or send

### One-Click Generation (Magic Button)
**What it is:** All-in-one workflow that completes entire process in < 3 seconds.

**What it does:**
1. Analyzes interview notes
2. Generates AI feedback
3. Creates humane letter
4. Runs bias detection
5. Optionally sends email

**How to use:**
1. Go to Candidate Profile > Decision tab
2. Click "Generate & Send" magic button
3. Confirm settings in modal
4. Click "Confirm"
5. Wait for completion (< 3 seconds)
6. Review confidence score (0-100)

**Confidence Score:**
- **90-100**: Excellent quality, ready to send
- **80-89**: Good quality, minor review recommended
- **70-79**: Acceptable, review recommended
- **< 70**: Needs human review

### Bulk Operations
**What it is:** Generate and send letters to multiple candidates at once.

**Bulk Letter Generation:**
1. Go to Candidates page
2. Filter by job or status
3. Select candidates (checkboxes)
4. Click "Bulk Actions" > "Generate Letters"
5. Configure settings (tone, feedback, etc.)
6. Click "Generate All"
7. Monitor progress bar
8. Review BulkOperation status

**Bulk Sending v2:**
1. Go to Decisions page
2. Filter decisions with generated letters
3. Select up to 500 decisions
4. Click "Bulk Send"
5. Optionally configure scheduling
6. Click "Send All"
7. Monitor progress
8. Handles idempotency (prevents double-sends)

**BulkOperation Status:**
- **PENDING**: Queued, not started
- **PROCESSING**: In progress
- **COMPLETED**: All successful
- **FAILED**: All failed
- **PARTIAL**: Some succeeded, some failed

**Error Handling:**
- First 10 errors captured for debugging
- Detailed error messages in operation log
- Failed items can be retried individually

### Letter Tones

**Formal:**
- Professional and traditional
- Suitable for corporate environments
- Example: "We regret to inform you..."

**Friendly:**
- Warm and approachable
- Suitable for startups and creative industries
- Example: "Thank you so much for your interest..."

**Empathetic:**
- Compassionate and supportive
- Suitable for sensitive situations
- Example: "We understand how much effort goes into applications..."

---

## Bias Detection & Fairness

### 11 Protected Categories
**What it is:** Comprehensive bias detection system analyzing letters for discriminatory language.

**Categories:**
1. **Age**: Recent graduate, decades of experience, young/old
2. **Gender**: He/she pronouns, gendered language, stereotypes
3. **Race/Ethnicity**: National origin, race references, ethnic names
4. **Disability**: Disability references, accommodation requests
5. **Religion**: Religious references, holidays, beliefs
6. **Pregnancy/Family Status**: Family planning, parental status
7. **Appearance**: Physical appearance, attractiveness, dress
8. **Health**: Medical conditions, HIPAA-protected information
9. **Accent/Language**: Language proficiency, accent references
10. **Marital Status**: Married, single, divorced references
11. **Cultural Fit**: Vague "fit" language without objective criteria

**How to use:**
1. After generating a letter, bias check runs automatically
2. View bias report in Decision tab
3. Review flagged issues:
   - Severity: Critical, High, Medium, Low
   - Score deduction: -25, -15, -5, -2
   - Specific suggestion for each issue
4. Edit letter to address issues
5. Re-run bias check
6. Aim for score 80+ (passing threshold)

**Bias Score:**
- **Starts at 100** (perfect score)
- **Deductions** based on severity
- **80+**: Pass (green)
- **60-79**: Review needed (yellow)
- **< 60**: Do not send (red)

### Fairness Testing Suite
**What it is:** Automated testing to ensure consistent treatment across demographics.

**How it works:**
1. 100 synthetic personas with diverse characteristics
2. Red-team harness tests edge cases
3. Automated regression testing in CI/CD
4. Tracks fairness scores over time

**How to use (for developers):**
```bash
# Run fairness tests
npm run test:fairness

# Update baseline
npm run test:fairness -- --updateBaseline

# View fairness report
cat fairness-report.json
```

### Disparate Impact Testing
**What it is:** EEOC Four-Fifths Rule compliance testing.

**How it works:**
- Compares selection rates across demographics
- Flags if any group's selection rate < 80% of highest group
- Example: If Group A has 50% selection rate, Group B must have ≥ 40%

**How to use:**
1. Go to Analytics > Fairness Dashboard
2. View disparate impact analysis
3. Filter by job, time period
4. Review flagged groups
5. Investigate root causes
6. Take corrective action

---

## Email & Communication

### Email Sending
**What it is:** Nodemailer-based SMTP email delivery with authentication.

**How to use:**
1. Ensure SMTP configured in environment:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@company.com
   SMTP_PASSWORD=app-password
   ```
2. In Decision page, click "Send Letter"
3. Review recipient email
4. Optionally schedule send time
5. Click "Send Now" or "Schedule"
6. Email delivered with:
   - SPF/DKIM/DMARC authentication
   - No tracking pixels (privacy-respecting)
   - Message-ID for tracking
   - Reply-to address set

### Smart Scheduling
**What it is:** AI-powered optimal send time recommendations based on research.

**How to use:**
1. In Decision page, click "Schedule Send"
2. View recommended times:
   - **Best**: Tuesday-Thursday, 9-11 AM or 2-3 PM
   - **Avoid**: Mondays (stressful), Fridays (ruins weekend), weekends
3. Select recommended time or custom time
4. Click "Schedule"
5. Email queued for future delivery

**Bulk Scheduling:**
- Spreads sends across optimal times
- Max 50 emails/day
- 2-minute intervals between sends
- Avoids overload and spam filters

**Confidence Levels:**
- **High**: Recommended time backed by research
- **Medium**: Acceptable time, not optimal
- **Low**: Sub-optimal time, may reduce open rates

### Alternative Scheduling Suggestions
**What it is:** Multiple time options with reasoning.

**How to use:**
1. Click "See Alternative Times"
2. View options:
   - Primary recommendation (highest confidence)
   - Alternative 1 (different day)
   - Alternative 2 (different time)
3. Select preferred option
4. Schedule

---

## Candidate Appeals

### Appeal Request System
**What it is:** Allows candidates to request clarification on rejection decisions.

**How it works:**
1. Candidate receives rejection letter
2. Letter includes appeal instructions
3. Candidate emails appeals address within 30 days
4. System creates appeal record
5. HR responds within 7 days (SLA)
6. Conversation thread tracked in JSON

**How to use (HR side):**
1. Go to Appeals page
2. View pending appeals
3. Click appeal to view:
   - Original decision
   - Candidate message
   - Interview notes
   - Thread history
4. Click "Respond"
5. Write response (template available)
6. Click "Send Response"
7. Status updated to RESPONDED
8. Close appeal when resolved

**Appeal Status:**
- **PENDING**: Awaiting HR response (< 7 days)
- **RESPONDED**: HR replied, awaiting candidate
- **CLOSED**: Resolved by HR
- **EXPIRED**: Exceeded 7-day SLA

**Limitations:**
- One appeal per decision (prevents spam)
- 30-day window from send date
- Email verification required
- Auto-expires after SLA deadline

---

## Data Subject Rights (DSR)

### GDPR/CCPA Compliance Portal
**What it is:** Self-service portal for data access and deletion requests.

**Request Types:**
1. **EXPORT**: Download all personal data
2. **DELETE**: Erase all personal data (Right to be Forgotten)

**How to use (Candidate side):**
1. Visit `/dsr` page
2. Enter email address
3. Select request type (EXPORT or DELETE)
4. Verify email via link
5. Submit request
6. Wait for processing (≤ 30 days)
7. Receive notification when complete
8. For EXPORT: Download secure file (expires in 7 days)

**How to use (HR side):**
1. Go to Settings > Data Subject Requests
2. View pending requests
3. Click request to review
4. Verify legitimacy
5. For EXPORT:
   - System auto-generates JSON file
   - Includes: candidate data, decisions, letters, audit logs
   - Pre-signed URL created
6. For DELETE:
   - Review data to be deleted
   - Confirm deletion
   - Data anonymized or hard-deleted per policy
7. Mark as COMPLETED
8. Candidate notified automatically

**Processing Time:**
- **Target**: 7-14 days
- **Maximum**: 30 days (legal requirement)
- **Status tracking**: PENDING → PROCESSING → COMPLETED/FAILED

**Audit Trail:**
- All DSR requests logged
- Retention: 7 years (legal compliance)
- Immutable records

---

## Security Features

### Idempotency System
**What it is:** Prevents duplicate operations (double-sends, double-charges) using distributed locks.

**How it works:**
1. Client generates idempotency key (UUID)
2. Client sends request with `Idempotency-Key` header
3. Server checks Redis cache
4. If key exists:
   - **In progress**: Returns 409 Conflict
   - **Completed**: Returns cached result (200 OK)
5. If key doesn't exist:
   - Acquires Redis lock
   - Processes request
   - Caches result (24-hour TTL)
   - Returns result

**How to use (API):**
```bash
# Generate idempotency key
KEY=$(uuidgen)

# Make request with key
curl -X POST /api/letters/generate \
  -H "Idempotency-Key: $KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"candidateId": "123"}'

# Retry with same key (safe)
curl -X POST /api/letters/generate \
  -H "Idempotency-Key: $KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"candidateId": "123"}'
# Returns cached result, no duplicate generated
```

**Endpoints with idempotency:**
- `/api/letters/generate`
- `/api/letters/send`
- `/api/bulk/send`
- `/api/payments/*` (Stripe)

### Rate Limiting
**What it is:** Three-tier system to prevent abuse and ensure fair usage.

**Tiers:**
1. **General API**: 60 requests/minute per user
2. **Auth Endpoints**: 15 requests/15 minutes per IP
3. **Strict Endpoints**: 10 requests/minute (AI operations)

**How to monitor:**
```bash
# Check rate limit headers
curl -I /api/candidates
# Returns:
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 45
# X-RateLimit-Reset: 1699999999
```

**What happens when exceeded:**
- Returns 429 Too Many Requests
- Includes `Retry-After` header (seconds)
- Logged for abuse monitoring

### Input Sanitization
**What it is:** Protection against XSS, SQL injection, and path traversal attacks.

**Technologies:**
- **DOMPurify**: Sanitizes HTML input
- **Zod**: Schema validation on all inputs
- **Prisma ORM**: Parameterized queries (prevents SQL injection)
- **Path validation**: Prevents directory traversal

**How it works (automatic):**
- All user input validated before processing
- Dangerous characters escaped or rejected
- File paths validated against whitelist
- HTML content sanitized before rendering

### API Key Management
**What it is:** Secure API keys for programmatic access.

**How to use:**
1. Go to Settings > API Keys
2. Click "Create API Key"
3. Enter description
4. Select scopes:
   - **Read**: View candidates, jobs, decisions
   - **Write**: Create/update records
   - **Admin**: Manage settings, users
5. Click "Generate"
6. Copy key (shown once only)
7. Store securely (1Password, AWS Secrets Manager)

**Key Security:**
- Keys hashed with bcrypt (never stored plaintext)
- Automatic rotation every 90 days
- Scoped permissions (principle of least privilege)
- Revocable at any time

**Usage:**
```bash
curl /api/candidates \
  -H "Authorization: Bearer sk_live_abc123..."
```

### Webhook Verification
**What it is:** HMAC-SHA256 signature verification for webhook endpoints.

**How to use (receiving webhooks):**
1. Get webhook secret from Settings > Webhooks
2. When webhook received, verify signature:
```javascript
import crypto from 'crypto';

const signature = req.headers['x-webhook-signature'];
const payload = JSON.stringify(req.body);
const secret = process.env.WEBHOOK_SECRET;

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```
3. Process webhook payload

### Data Encryption
**What it is:** Multi-layer encryption for data protection.

**Layers:**
1. **At Rest**:
   - Database: AES-256 encryption
   - S3/R2: Server-side encryption
   - Redis: Encryption enabled
   - Backups: Encrypted before storage

2. **In Transit**:
   - TLS 1.3 for all HTTPS traffic
   - Certificate pinning for API
   - No TLS 1.0/1.1 support

3. **Client-Side**:
   - Sensitive fields encrypted before upload
   - Encryption key derived from user password
   - Zero-knowledge architecture for PII

**How to use (automatic):**
- All encryption handled automatically
- No user action required
- Transparent encryption/decryption

---

## Audit & Compliance

### Comprehensive Audit Logging
**What it is:** Complete trail of all system actions for compliance and security.

**Logged Information:**
- **Who**: User ID, email, role
- **What**: Action type (CREATE, UPDATE, DELETE, VIEW)
- **When**: Timestamp (UTC)
- **Where**: IP address, user agent, geolocation
- **Why**: Context (e.g., "Bulk send operation")
- **Result**: Success/failure, error details

**How to use:**
1. Go to Settings > Audit Logs
2. Filter by:
   - User
   - Action type
   - Date range
   - Resource (candidate, job, decision)
3. Click entry to view full details
4. Export to CSV for compliance reporting

**Retention:**
- 7 years (legal requirement)
- Append-only (immutable)
- Backed up daily

**Use Cases:**
- Security investigations
- Compliance audits (SOC 2, GDPR)
- User activity monitoring
- Debugging issues

### Compliance Standards

#### GDPR (General Data Protection Regulation)
**Coverage:**
- Right to access (DSR Export)
- Right to deletion (DSR Delete)
- Right to rectification (Edit candidate data)
- Right to data portability (CSV/JSON export)
- Consent management
- Data minimization
- Privacy by design

#### CCPA (California Consumer Privacy Act)
**Coverage:**
- Right to know (DSR Export)
- Right to delete (DSR Delete)
- Right to opt-out (Marketing consent)
- Non-discrimination
- Privacy policy disclosure

#### EEOC (Equal Employment Opportunity Commission)
**Coverage:**
- Bias detection (11 protected categories)
- Disparate impact testing (Four-Fifths Rule)
- Adverse action notices
- Record retention (7 years)
- Affirmative action reporting

#### SOC 2 Type II
**Coverage:**
- Security controls (encryption, MFA, RBAC)
- Availability (99.9% uptime SLA)
- Processing integrity (idempotency, validation)
- Confidentiality (data access controls)
- Privacy (GDPR/CCPA compliance)

---

## Subscription & Billing

### Stripe Integration
**What it is:** Payment processing and subscription management.

**Subscription Tiers:**
1. **FREE**:
   - 10 candidates/month
   - 5 letters/month
   - Basic templates
   - Email support

2. **STARTER** ($99/month):
   - 100 candidates/month
   - 50 letters/month
   - Custom templates
   - Bias detection
   - Email support

3. **PROFESSIONAL** ($299/month):
   - 500 candidates/month
   - 200 letters/month
   - All features
   - Priority support
   - Custom branding
   - API access

4. **ENTERPRISE** (Custom):
   - Unlimited candidates
   - Unlimited letters
   - Dedicated support
   - Custom integrations
   - SLA guarantees
   - On-premise option

**How to use:**
1. Go to Settings > Billing
2. Click "Upgrade Plan"
3. Select tier
4. Enter payment method
5. Review charges
6. Click "Subscribe"
7. Redirected to Stripe Checkout
8. Complete payment
9. Subscription activated

**Subscription Status:**
- **TRIAL**: 14-day free trial
- **ACTIVE**: Paid and current
- **PAST_DUE**: Payment failed, retry in progress
- **CANCELED**: User canceled, access until period end
- **UNPAID**: Payment failed multiple times, access revoked

**Webhook Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**How to manage:**
1. Go to Settings > Billing
2. View current plan and usage
3. Click "Manage Subscription"
4. Options:
   - Change plan (upgrade/downgrade)
   - Update payment method
   - View invoices
   - Cancel subscription

---

## Template Management

### Custom Templates
**What it is:** Company-specific letter templates with variables.

**How to use:**
1. Go to Settings > Templates
2. Click "Create Template"
3. Enter template details:
   - Name (e.g., "Senior Engineer Rejection - Friendly")
   - Tone (Formal, Friendly, Empathetic)
   - Jurisdiction (US, EU, CA)
   - Type (Rejection, Offer, Interview Request)
4. Write template body with variables:
   ```
   Dear {{candidateName}},

   Thank you for applying for {{jobTitle}} at {{companyName}}.

   {{feedbackBlock}}

   We wish you the best in your job search.

   Sincerely,
   {{senderName}}
   ```
5. Available variables:
   - `{{candidateName}}`: Candidate's name
   - `{{jobTitle}}`: Job title
   - `{{companyName}}`: Company name
   - `{{feedbackBlock}}`: AI-generated feedback
   - `{{senderName}}`: Sender's name
   - `{{senderTitle}}`: Sender's title
   - `{{date}}`: Current date
6. Click "Save Template"
7. Optionally run template linting (auto bias check)

### System Templates
**What it is:** Pre-built, compliance-tested templates.

**Available Templates:**
- **US-Formal-Rejection**: EEOC-compliant formal rejection
- **US-Friendly-Rejection**: Warm US rejection
- **EU-GDPR-Rejection**: GDPR-compliant with DSR instructions
- **CA-Friendly-Rejection**: Canadian jurisdiction-specific
- **Generic-Offer**: Job offer template
- **Interview-Request**: Schedule interview template

**How to use:**
1. In letter generation, select "Use System Template"
2. Choose template from dropdown
3. Template auto-filled with jurisdiction-specific wording
4. AI generates feedback
5. Review and send

### Template Versioning
**What it is:** Audit trail of template changes.

**How it works:**
- Every template edit creates new version
- Previous versions archived (not deleted)
- Can revert to previous version
- Version history shows:
  - Date modified
  - Modified by (user)
  - Changes summary

**How to use:**
1. Go to Settings > Templates
2. Click template name
3. Click "View History"
4. See all versions
5. Click "Restore" on previous version if needed

---

## Browser Extension

### Installation
**What it is:** Manifest V3 browser extension for Chrome, Edge, Firefox.

**How to install:**
1. Download from Chrome Web Store / Firefox Add-ons
2. Or load unpacked:
   ```bash
   cd extension
   npm install
   npm run build
   ```
3. Chrome: Extensions > Load unpacked > Select `dist/` folder
4. Firefox: about:debugging > Load Temporary Add-on > Select `dist/manifest.json`

### ATS Integration
**What it is:** Extract structured rubric data from ATS platforms.

**Supported Platforms:**
- Greenhouse
- Lever
- Workday
- Jazz HR
- Breezy HR

**How to use:**
1. Navigate to ATS candidate profile
2. Click extension icon in toolbar
3. Extension auto-detects ATS platform
4. Click "Extract Rubric Data"
5. Extension scrapes evaluation scores
6. Review extracted data:
   - Rubric name
   - Score (1-10)
   - Weight (%)
   - Notes
7. Click "Send to Humane"
8. Data sent to web app
9. Generates letter based on rubric
10. Review and send from web app

**Privacy-Safe Data Extraction:**
- **Only extracts**: Rubric names, scores, weights, interview notes
- **Never extracts**: Names, emails, addresses, SSNs, phone numbers, raw resumes
- **Context-aware**: Reads only evaluation criteria sections
- **No background tracking**: Extension only active when clicked

### Configuration
**How to use:**
1. Click extension icon
2. Click "Settings" gear icon
3. Configure:
   - API endpoint (default: production)
   - API key (from web app Settings > API Keys)
   - Auto-extract (on page load vs. manual)
   - Default tone (Formal, Friendly, Empathetic)
4. Save settings
5. Settings synced across devices (Chrome Sync)

---

## Analytics & Monitoring

### Custom Metrics
**What it is:** Track business KPIs with custom events.

**How to use (API):**
```bash
POST /api/analytics/custom-metrics
{
  "name": "letters_sent",
  "type": "counter",
  "value": 1,
  "tags": {
    "job_id": "123",
    "tone": "friendly"
  }
}
```

**Metric Types:**
- **Counter**: Incrementing values (e.g., letters sent)
- **Gauge**: Current values (e.g., active candidates)
- **Histogram**: Distributions (e.g., generation time)

**How to view:**
1. Go to Analytics > Custom Metrics
2. Select metric from dropdown
3. Filter by tags
4. View chart (line, bar, pie)
5. Export to CSV

### Web Vitals Tracking
**What it is:** Real user monitoring (RUM) for performance.

**Tracked Metrics:**
- **FCP** (First Contentful Paint): < 1.8s
- **LCP** (Largest Contentful Paint): < 2.5s
- **TTI** (Time to Interactive): < 3.8s
- **CLS** (Cumulative Layout Shift): < 0.1

**How to view:**
1. Go to Analytics > Web Vitals
2. View dashboard:
   - Median values
   - 75th percentile
   - 95th percentile
3. Filter by:
   - Page
   - Date range
   - Device (mobile, desktop)
4. Identify slow pages
5. Investigate issues

### Error Tracking
**What it is:** Sentry integration for automatic error capture.

**What's captured:**
- JavaScript errors
- Unhandled promise rejections
- API errors (4xx, 5xx)
- User context (ID, email, role)
- Breadcrumbs (user actions before error)
- Source maps (for stack traces)

**How to view:**
1. Go to Sentry dashboard (external)
2. View issues sorted by frequency
3. Click issue to see:
   - Error message and stack trace
   - User context
   - Breadcrumbs timeline
   - Environment (browser, OS, version)
4. Assign to developer
5. Link to GitHub issue
6. Mark as resolved when fixed

---

## UX Enhancements

### AI Copilot
**What it is:** GPT-4 powered assistant for context-aware help.

**How to use:**
1. Click AI Copilot button (bottom right)
2. Ask questions:
   - "How do I create a job?"
   - "What's the bias score mean?"
   - "Show me pending appeals"
3. Copilot provides:
   - Step-by-step instructions
   - Smart suggestions for next actions
   - Page-specific guidance
4. Click suggested action to execute
5. Close copilot when done

**Context-Aware:**
- **Jobs page**: Suggests creating job, filtering candidates
- **Candidate page**: Suggests adding notes, generating letter
- **Analytics page**: Suggests viewing fairness report
- **Letter generation**: Suggests optimal tone, scheduling

### Command Palette (Cmd+K)
**What it is:** Keyboard-first navigation and search.

**How to use:**
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
2. Type to search:
   - **Pages**: "jobs", "candidates", "analytics"
   - **Actions**: "create job", "generate letter", "export data"
   - **Searches**: Candidate names, job titles
3. Navigate with keyboard:
   - `↑` / `↓`: Move selection
   - `Enter`: Execute action
   - `Esc`: Close palette
4. View keyboard shortcuts: Type "shortcuts"

**Categories:**
- **Navigation**: Go to pages
- **Actions**: Trigger operations
- **Search**: Find records
- **Recent**: Recently viewed items
- **Favorites**: Starred items

### Keyboard Shortcuts
**What it is:** Power user productivity shortcuts.

**Universal Shortcuts:**
- `Cmd/Ctrl + K`: Open command palette
- `Cmd/Ctrl + /`: Show help
- `Esc`: Close modal/palette
- `Cmd/Ctrl + S`: Save (in forms)

**Navigation:**
- `J` / `K`: Navigate list items (vim-style)
- `Enter`: Select/open item
- `G then G`: Go to top
- `Shift + G`: Go to bottom

**Context-Specific:**
- **Jobs page**:
  - `N`: New job
  - `F`: Filter jobs
  - `S`: Sort jobs
- **Candidates page**:
  - `N`: New candidate
  - `E`: Export
  - `I`: Import
- **Letter editor**:
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + Y`: Redo
  - `Cmd/Ctrl + B`: Bold
  - `Cmd/Ctrl + I`: Italic

### Optimistic UI Updates
**What it is:** Instant feedback before server response.

**How it works:**
1. User clicks "Save"
2. UI updates immediately (button changes to "Saved")
3. Request sent to server
4. If successful: UI state persists
5. If failed: UI reverts, shows error

**Where used:**
- Saving templates
- Updating candidate status
- Marking tasks complete
- Adding notes

### Undo/Redo System
**What it is:** Time-travel editing for letter editor.

**How to use:**
1. Edit letter content
2. Press `Cmd/Ctrl + Z` to undo
3. Press `Cmd/Ctrl + Y` to redo
4. State history preserved
5. Auto-save every 1 second (debounced)
6. Can undo up to 50 actions

### Debounced Inputs
**What it is:** Reduces API calls by waiting for user to stop typing.

**Where used:**
- Search fields (300ms debounce)
- Auto-save (1000ms debounce)
- Filter inputs (500ms debounce)

**How it works:**
1. User types in search box
2. Timer starts (300ms)
3. User continues typing, timer resets
4. User stops typing
5. Timer completes
6. API call made with search query

---

## Internationalization

### Multi-Language Support
**What it is:** next-intl integration for localized UI.

**Supported Locales:**
- `en-US`: English (United States)
- `en-EU`: English (European Union)
- `en-CA`: English (Canada)
- `es-ES`: Spanish (Spain)
- `fr-FR`: French (France)
- `de-DE`: German (Germany)

**How to use:**
1. Go to Settings > Preferences
2. Select language from dropdown
3. UI translates immediately
4. Language preference saved
5. Applies to emails, letters, UI

### Jurisdiction Packs
**What it is:** Locale-specific rules and configurations.

**What's included:**
- **Holidays**: National holidays for scheduling
- **Send-time rules**: Country-specific best practices
- **Legal disclaimers**: Required compliance text
- **Wording preferences**: Cultural norms (US vs. EU tone)

**How it works (automatic):**
1. Job created with jurisdiction (US/EU/CA)
2. System loads jurisdiction pack
3. Templates auto-include disclaimers
4. Scheduling avoids national holidays
5. Bias detection uses jurisdiction-specific rules

**Example differences:**
- **US**: Can mention "at-will employment"
- **EU**: Must include GDPR rights in rejection
- **CA**: Must include PIPEDA compliance text

---

## Additional Features

### Notifications (SSE)
**What it is:** Real-time updates via Server-Sent Events.

**How it works:**
1. User logs in
2. Browser opens SSE connection to `/api/notifications/stream`
3. Server pushes events:
   - `decision.created`: New decision made
   - `letter.generated`: Letter ready to review
   - `letter.sent`: Letter successfully sent
   - `candidate.applied`: New candidate applied
   - `interview_note.created`: New interview note
4. UI shows toast notification
5. Updates relevant pages automatically

**How to use:**
- Notifications show automatically
- Click notification to view details
- Mark as read by clicking
- View all in Notifications panel (bell icon)

### Health Checks
**What it is:** System status monitoring endpoint.

**How to use:**
```bash
curl /api/health
# Returns:
{
  "status": "healthy",
  "timestamp": "2025-11-10T12:34:56Z",
  "version": "1.5.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "s3": "healthy"
  }
}
```

**Status Codes:**
- **200**: All systems operational
- **503**: One or more services degraded

### OpenAPI Documentation
**What it is:** Auto-generated API documentation with interactive explorer.

**How to use:**
1. Navigate to `/api/docs`
2. View OpenAPI spec (JSON)
3. Or visit `/docs` for Swagger UI
4. Explore endpoints:
   - View parameters
   - See request/response schemas
   - Try API calls interactively
5. Generate API clients:
   ```bash
   npm install @openapitools/openapi-generator-cli
   openapi-generator-cli generate -i /api/docs -g typescript-axios -o ./client
   ```

### Feature Flags
**What it is:** Per-tenant toggles for gradual rollouts.

**How to use (Admin):**
1. Go to Settings > Feature Flags
2. View available flags:
   - `ai_copilot_enabled`
   - `bulk_send_v2_enabled`
   - `appeals_system_enabled`
   - `smart_scheduling_enabled`
3. Toggle flag on/off for your company
4. Changes take effect immediately
5. No deployment required

**How it works:**
- Flags checked at runtime
- Per-company or per-user granularity
- A/B testing capability
- Gradual rollout (10% → 50% → 100%)

### Onboarding Flow
**What it is:** Guided setup for new companies.

**How to use:**
1. After signup, redirected to onboarding
2. Steps:
   - **Company Info**: Name, industry, size
   - **Jurisdiction**: US/EU/CA
   - **SMTP Setup**: Configure email sending
   - **Create First Job**: Add job posting
   - **Invite Team**: Add team members
   - **API Keys**: Generate API key (optional)
3. Progress bar shows completion
4. Can skip and return later
5. Mark complete: `POST /api/onboarding/complete`

---

## Quick Reference

### Common Workflows

#### Generate and Send Rejection Letter
1. Navigate to Candidate Profile
2. Go to Decision tab
3. Click "Generate & Send" (Magic Button)
4. Review settings (tone, feedback, schedule)
5. Click "Confirm"
6. Wait for generation (< 3 seconds)
7. Review confidence score
8. Edit if needed
9. Click "Send Now" or "Schedule"

#### Bulk Send to 100 Candidates
1. Go to Candidates page
2. Filter by job and status (REJECTED)
3. Select candidates (checkboxes)
4. Click "Bulk Actions" > "Generate Letters"
5. Wait for generation (progress bar)
6. Go to Decisions page
7. Filter by "Letters Generated, Not Sent"
8. Select decisions (up to 500)
9. Click "Bulk Send"
10. Configure scheduling (optional)
11. Click "Send All"
12. Monitor BulkOperation status

#### Handle Candidate Appeal
1. Receive appeal notification
2. Go to Appeals page
3. Click appeal to view details
4. Review original decision and interview notes
5. Click "Respond"
6. Write response using template
7. Click "Send Response"
8. Appeal marked as RESPONDED
9. If resolved, click "Close Appeal"

#### Export Data for Compliance Audit
1. Go to Settings > Audit Logs
2. Select date range (e.g., 2024-01-01 to 2024-12-31)
3. Filter by action types (if needed)
4. Click "Export to CSV"
5. Download file
6. Provide to auditor

---

## Support & Resources

### Documentation
- **Full docs**: `/docs` directory
- **API docs**: `/api/docs` (OpenAPI)
- **Security docs**: `SECURITY.md`
- **Fairness docs**: `FAIRNESS.md`
- **Idempotency docs**: `IDEMPOTENCY.md`

### Support Channels
- **Email**: support@humane-jobs.com
- **Chat**: In-app chat (bottom right)
- **Knowledge Base**: help.humane-jobs.com
- **Status Page**: status.humane-jobs.com

### Training Resources
- **Video tutorials**: YouTube channel
- **Webinars**: Monthly product updates
- **Certification**: HR Professional Certification Program

---

## Version History

- **v1.5.0** (2024-11-10): Feature flags, onboarding flow, AI copilot
- **v1.4.0** (2024-10-15): Smart scheduling, appeals system
- **v1.3.0** (2024-09-20): Bulk send v2, idempotency
- **v1.2.0** (2024-08-10): DSR portal, GDPR compliance
- **v1.1.0** (2024-07-01): Browser extension, ATS integration
- **v1.0.0** (2024-06-01): Initial launch

---

**Last Updated**: 2025-11-10
**Document Version**: 1.0.0
