# Security Architecture & Threat Model

**Last Updated**: 2024-01-20
**Version**: 1.0
**Status**: Production Ready

## Table of Contents

1. [Security Principles](#security-principles)
2. [STRIDE Threat Model](#stride-threat-model)
3. [LINDDUN Privacy Threats](#linddun-privacy-threats)
4. [Data Loss Prevention (DLP)](#data-loss-prevention)
5. [Authentication & Authorization](#authentication--authorization)
6. [Data Protection](#data-protection)
7. [API Security](#api-security)
8. [Third-Party Integrations](#third-party-integrations)
9. [Incident Response](#incident-response)
10. [Security Testing](#security-testing)

---

## Security Principles

### Zero Trust Architecture
- **Never trust, always verify**: All requests are authenticated and authorized
- **Least privilege**: Users and services have minimum required permissions
- **Defense in depth**: Multiple layers of security controls
- **Assume breach**: Monitor and detect anomalies continuously

### Privacy by Design
- **Data minimization**: Collect only what's necessary
- **Purpose limitation**: Use data only for stated purpose
- **Transparency**: Clear privacy policies and consent
- **User control**: Users can access, correct, and delete their data

### Compliance Requirements
- **GDPR** (EU): Right to explanation, data portability, erasure
- **EEOC** (US): No bias in hiring decisions
- **CCPA** (California): Consumer privacy rights
- **SOC 2 Type II**: Security, availability, confidentiality

---

## STRIDE Threat Model

STRIDE is a framework for identifying threats across 6 categories:

### 1. Spoofing (Identity)

**Threat**: Attacker impersonates a legitimate user or service

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| Stolen credentials | Clerk WebAuthn/Passkeys, MFA required for admins | ✅ Implemented |
| Session hijacking | HTTP-only cookies, SameSite=Strict, 1-hour expiry | ✅ Implemented |
| API key theft | Scoped keys, rate limiting, audit logs | ✅ Implemented |
| Email spoofing | DKIM/SPF/DMARC verification, sender validation | ✅ Implemented |

**Additional Controls**:
- Clerk handles session management with industry-standard JWT rotation
- API keys stored hashed (SHA-256) in database
- Failed login attempts trigger rate limiting (5 attempts/15min)

---

### 2. Tampering (Data)

**Threat**: Attacker modifies data in transit or at rest

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| Man-in-the-middle | TLS 1.3 enforced, HTTPS redirect | ✅ Implemented |
| SQL injection | Parameterized queries (Prisma ORM) | ✅ Implemented |
| XSS attacks | Input sanitization, CSP headers | ✅ Implemented |
| CSV injection | Excel formula stripping in batch uploads | ✅ Implemented |
| Database tampering | Cryptographic receipts (SHA-256 + HMAC) | ✅ Implemented |

**Additional Controls**:
- All database writes create audit logs with timestamps
- Explainable receipts provide tamper-evident decision records
- Content Security Policy (CSP): `default-src 'self'; script-src 'self' 'unsafe-inline'`
- Subresource Integrity (SRI) for CDN resources

---

### 3. Repudiation (Non-repudiation)

**Threat**: User denies performing an action

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| No audit trail | Comprehensive audit logs (Prisma middleware) | ✅ Implemented |
| Missing timestamps | All records have createdAt/updatedAt | ✅ Implemented |
| Anonymous actions | All state-changing operations require authentication | ✅ Implemented |
| Decision disputes | Cryptographic receipts with HMAC signatures | ✅ Implemented |

**Audit Log Coverage**:
- User actions: login, logout, role changes
- Decision events: create, send, appeal
- Bulk operations: start, progress, completion
- Configuration changes: feature flags, templates, rubrics

**Retention**: 90 days (configurable per-tenant)

---

### 4. Information Disclosure (Confidentiality)

**Threat**: Unauthorized access to sensitive data

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| Database leaks | Encryption at rest (AES-256), field-level encryption for PII | ✅ Implemented |
| Log leaks | PII redaction in logs (emails → `e***@***.com`) | ✅ Implemented |
| LLM prompt injection | No PII in prompts, banned phrase filtering | ✅ Implemented |
| API over-fetching | GraphQL field filtering, RBAC on endpoints | ✅ Implemented |
| Timing attacks | Constant-time comparisons for HMAC verification | ✅ Implemented |

**Critical DLP Policy** (see section below):
- **NEVER send resumes/CVs to LLM providers**
- **NEVER include candidate names in LLM prompts**
- **NEVER store credit card data** (use Stripe tokenization)

---

### 5. Denial of Service (Availability)

**Threat**: Attacker makes service unavailable

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| API flooding | Three-tier rate limiting (60/min, 15/15min, 10/min) | ✅ Implemented |
| Large file uploads | 10MB max file size, streaming processing | ✅ Implemented |
| Slowloris attacks | Nginx timeout (30s), connection limits | ✅ Implemented |
| Email bombing | Rate limit bulk sends (500 max, 50/batch) | ✅ Implemented |
| Database exhaustion | Connection pooling (max 20), query timeouts (10s) | ✅ Implemented |

**Rate Limiting Strategy**:
```typescript
// Tier 1: Per-endpoint burst protection
- 60 requests/minute per IP per endpoint

// Tier 2: Global account limits
- 15 requests per 15 minutes per company (state-changing operations)

// Tier 3: Premium bypass
- 10x multiplier for Enterprise tier
```

**Monitoring**: Sentry alerts on 5xx errors, Web Vitals track LCP/FID/CLS

---

### 6. Elevation of Privilege (Authorization)

**Threat**: Attacker gains unauthorized permissions

| Attack Vector | Mitigation | Status |
|--------------|------------|--------|
| IDOR attacks | Resource ownership checks, RBAC middleware | ✅ Implemented |
| Broken access control | Server-side authorization on every request | ✅ Implemented |
| JWT manipulation | Clerk-managed tokens, signature verification | ✅ Implemented |
| Role escalation | Audit logs on role changes, admin approval required | ✅ Implemented |

**RBAC Matrix**:

| Role | View Candidates | Create Decisions | Send Letters | Manage Users | Respond to Appeals |
|------|----------------|------------------|--------------|--------------|-------------------|
| Viewer | Own company | ❌ | ❌ | ❌ | ❌ |
| Hiring Manager | Own jobs | Own jobs | Own jobs | ❌ | Own jobs |
| Admin | All | All | All | All | All |
| Super Admin | All companies | All companies | All companies | All companies | All companies |

**Authorization Check Example**:
```typescript
// Every API route starts with this
const user = await requireAuth(req);
await requireRole(user, ["admin", "hiring_manager"]);
await requireCompanyAccess(user, resourceCompanyId);
```

---

## LINDDUN Privacy Threats

LINDDUN extends STRIDE with privacy-specific threats:

### 1. Linking

**Threat**: Attacker correlates data to re-identify individuals

**Mitigations**:
- Candidate emails hashed (SHA-256) for analytics
- No cross-company data sharing
- Aggregated metrics only (min group size: 10)

### 2. Identifying

**Threat**: Attacker identifies individuals from anonymized data

**Mitigations**:
- K-anonymity (k=10) for fairness reports
- No unique identifiers in export files
- PII redaction in logs and error messages

### 3. Non-repudiation (Privacy)

**Threat**: User cannot deny consent/participation

**Mitigations**:
- Explicit opt-in for data processing
- Withdrawal option in every email
- Audit trail shows consent timestamps

### 4. Detecting

**Threat**: Attacker detects presence/absence of individual in dataset

**Mitigations**:
- Differential privacy (ε=0.1) for aggregate stats
- No "zero results" responses (return empty list)
- Rate limiting on search queries

### 5. Data Disclosure

**Threat**: Sensitive attributes revealed

**Mitigations**:
- Field-level encryption for SSN, DOB (if stored)
- No protected class data in decisions
- Explainable cards exclude bias-prone language

### 6. Unawareness

**Threat**: Users unaware of data processing

**Mitigations**:
- Privacy policy linked in every email
- Data usage explained in appeals portal
- GDPR-compliant consent banners

### 7. Non-compliance

**Threat**: Violating privacy regulations

**Mitigations**:
- GDPR Article 22 (right to explanation) → Explainable Cards
- GDPR Article 17 (right to erasure) → Soft deletes with 30-day retention
- CCPA opt-out → `data_sharing_opt_out` flag per candidate

---

## Data Loss Prevention (DLP)

### Critical Policy: NEVER Send Resumes to LLMs

**Why**: Resumes contain PII (names, addresses, phone numbers, emails, SSNs) and protected class indicators (age via graduation dates, race via names, disability via accommodations).

**Enforcement**:
1. **Input validation**: Reject API requests with `resumeText` field
2. **Prompt templates**: No placeholders for resume content
3. **Code review**: All LLM calls audited in CI/CD
4. **Monitoring**: Sentry alert on any prompt > 2000 tokens (likely includes resume)

**What We DO Send to LLMs**:
- Job title (sanitized)
- Rubric scores (numeric only, no names)
- Template text (pre-linted for bias)
- Tone/locale preferences (enum values)

**Example Safe Prompt**:
```typescript
const prompt = `
You are a professional HR assistant. Generate a rejection letter for the role of "${sanitize(jobTitle)}".

The candidate scored below the threshold in these areas:
${rubricDeltas.map(d => `- ${d.criterion}: ${d.delta} points below passing`).join('\n')}

Use a ${tone} tone. Do not include specific scores.
`;
```

### Additional DLP Rules

| Data Type | Storage | Transmission | LLM Usage | Retention |
|-----------|---------|--------------|-----------|-----------|
| Resume/CV | Encrypted at rest | TLS 1.3 | ❌ NEVER | 90 days post-rejection |
| Name | Hashed for analytics | TLS 1.3 | ❌ NEVER | Until erasure request |
| Email | Encrypted at rest | TLS 1.3 | ❌ NEVER | Until erasure request |
| Phone | Encrypted at rest | TLS 1.3 | ❌ NEVER | Until erasure request |
| SSN/ID | ❌ Not collected | N/A | ❌ NEVER | N/A |
| Rubric scores | Plaintext | TLS 1.3 | ✅ Anonymized | Until erasure request |
| Interview notes | Encrypted at rest | TLS 1.3 | ❌ NEVER | Until erasure request |

---

## Authentication & Authorization

### Authentication (Clerk)

**Supported Methods**:
1. **Passkeys** (WebAuthn) - Preferred
2. **Magic links** (email-based, no password)
3. **Social OAuth** (Google, Microsoft, LinkedIn)
4. **Email + password** (with breach detection via HaveIBeenPwned)

**MFA Policy**:
- Required for all Admin and Super Admin roles
- Optional for Hiring Manager and Viewer roles
- Enforced via Clerk organization settings

**Session Management**:
- JWT tokens with 1-hour expiry
- Refresh tokens with 7-day expiry
- Automatic rotation on every request
- Logout invalidates all sessions

### Authorization (RBAC)

**Role Hierarchy**:
```
Super Admin (multi-tenant)
  └─ Admin (company-level)
      └─ Hiring Manager (job-level)
          └─ Viewer (read-only)
```

**Permission Scoping**:
```typescript
// Middleware checks every request
export async function requirePermission(
  user: User,
  action: "read" | "write" | "admin",
  resource: { type: "candidate" | "job" | "decision"; companyId: string; jobId?: string }
) {
  // 1. Check authentication
  if (!user) throw new UnauthorizedError();

  // 2. Check role
  if (action === "admin" && !["admin", "super_admin"].includes(user.role)) {
    throw new ForbiddenError();
  }

  // 3. Check company access
  if (user.role !== "super_admin" && user.companyId !== resource.companyId) {
    throw new ForbiddenError();
  }

  // 4. Check job-level access for hiring managers
  if (user.role === "hiring_manager" && resource.jobId) {
    const hasAccess = await db.job.findFirst({
      where: { id: resource.jobId, hiringManagerId: user.id }
    });
    if (!hasAccess) throw new ForbiddenError();
  }

  return true;
}
```

### API Key Management

**Key Types**:
1. **Read-only keys**: Can fetch candidates, jobs, decisions
2. **Write keys**: Can create decisions, send letters
3. **Admin keys**: Can manage company settings

**Security**:
- Keys stored hashed (SHA-256 with salt)
- Prefix-based identification (e.g., `sk_live_abc123...`)
- Automatic expiration (90 days, configurable)
- Rate limiting per key
- Audit log on every use

---

## Data Protection

### Encryption at Rest

**Database**: PostgreSQL with pgcrypto extension
- AES-256-GCM for column-level encryption
- Fields encrypted: `email`, `phone`, `resumeText`, `address`
- Master key stored in AWS Secrets Manager / Vault
- Key rotation: every 90 days

**File Storage**: S3 with SSE-KMS
- Resume files encrypted with customer-managed keys (CMK)
- Bucket policy: deny unencrypted uploads
- Access logs enabled

### Encryption in Transit

- **TLS 1.3** enforced (TLS 1.2 minimum)
- **HSTS**: `max-age=31536000; includeSubDomains; preload`
- **Certificate pinning** for mobile apps (if applicable)
- **No mixed content**: All resources served over HTTPS

### Data Minimization

**What We DON'T Collect**:
- Social Security Numbers (SSN)
- Driver's license numbers
- Credit card numbers (use Stripe tokenization)
- Genetic information
- Biometric data (unless WebAuthn)
- Protected class attributes (race, religion, age, disability)

**What We DO Collect (Minimum Necessary)**:
- Name, email, phone (for communication)
- Resume text (stored encrypted, never sent to LLMs)
- Interview scores (rubric-based, no free-text)
- Decision outcome + reasons (auditable)

### Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|-----------------|----------------|
| Candidates | 90 days post-rejection | Soft delete → Hard delete after 30 days |
| Decisions | 7 years (legal compliance) | Hard delete after statute of limitations |
| Audit logs | 90 days | Archived to S3 Glacier → Deleted after 7 years |
| Email logs | 30 days | Hard delete |
| Error logs | 30 days | Hard delete (PII redacted) |
| Explainable receipts | 7 years | Hard delete (archived for legal hold) |

**GDPR Right to Erasure**:
- User submits request via appeals portal
- 30-day grace period (allows mistake correction)
- Cascading deletion: `Candidate` → `Decision` → `Appeal` → `ExplainableReceipt`
- Audit log entry preserved (but PII redacted)

---

## API Security

### Input Validation

**Zod Schemas** for all API routes:
```typescript
const CreateDecisionSchema = z.object({
  jobId: z.string().cuid(),
  candidateId: z.string().cuid(),
  outcome: z.enum(["rejected", "hired", "withdrawn"]),
  reasons: z.array(z.string()).min(1).max(10),
  tone: z.enum(["formal", "friendly", "empathetic"]).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
```

**Sanitization**:
- HTML tags stripped from user input (DOMPurify)
- SQL special characters escaped (Prisma handles this)
- Excel formulas removed from CSV uploads (prevent CSV injection)

### Output Encoding

- JSON responses: automatic escaping by Next.js
- HTML rendering: React escapes by default
- CSV exports: fields quoted, formulas stripped

### CORS Policy

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "https://app.humanejob.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
  "Access-Control-Max-Age": "86400", // 24 hours
};
```

**No wildcard `*` allowed in production**

### Rate Limiting

See [STRIDE - Denial of Service](#5-denial-of-service-availability) for details.

**Implementation**: Redis-backed sliding window
```typescript
const rateLimitKey = `ratelimit:${ip}:${endpoint}`;
const count = await redis.incr(rateLimitKey);
if (count === 1) await redis.expire(rateLimitKey, 60); // 1 minute
if (count > LIMIT) throw new TooManyRequestsError();
```

---

## Third-Party Integrations

### LLM Providers (OpenAI, Anthropic)

**Security Controls**:
1. **No PII in prompts** (see DLP section)
2. **Banned phrase filtering** (30+ patterns for protected classes)
3. **Temperature capping** (max 0.8 to prevent hallucinations)
4. **Timeout enforcement** (60s max, 30s primary + 30s fallback)
5. **Token budget limits** (max 4k tokens per request)
6. **Idempotency keys** (prevent duplicate charges)
7. **API key rotation** (every 90 days)
8. **Provider isolation** (no fallback to untrusted models)

**Data Residency**:
- OpenAI: US-based (GDPR DPA signed)
- Anthropic: US-based (GDPR DPA signed)
- Stub provider: No external calls (for testing)

**Zero Data Retention Agreement**:
- OpenAI API: 30-day retention → 0-day for enterprise customers
- Anthropic: Zero-retention by default

### ATS Integrations (Greenhouse, Lever, Workday)

**Webhook Security**:
1. **Signature verification**: HMAC-SHA256 of payload
2. **Timestamp validation**: Reject requests > 5 minutes old
3. **IP allowlisting**: Only accept from ATS provider IPs
4. **Idempotency**: Duplicate webhooks ignored (check event ID)

**Authentication**:
- OAuth 2.0 for API access
- Scopes: read:candidates, read:applications, write:notes
- Token refresh: automatic every 50 minutes (1-hour expiry)

### Email Provider (Resend, SendGrid)

**Security**:
- DKIM/SPF/DMARC configured for domain
- Bounce/complaint handling (auto-unsubscribe)
- Rate limiting (1000 emails/hour for Free tier)
- Link tracking disabled (privacy)

### Payment Provider (Stripe)

**PCI DSS Compliance**:
- No credit card data stored (use Stripe Checkout)
- Tokenization for recurring billing
- Webhook signature verification (stripe-signature header)
- 3D Secure (SCA) for EU customers

---

## Incident Response

### Incident Classification

| Priority | Definition | Response SLA | Notification |
|----------|-----------|--------------|--------------|
| **P0 - Critical** | Data breach, service down for all users | 15 minutes | CEO, CTO, CISO, all engineers |
| **P1 - High** | Security vulnerability exploited, service degraded | 1 hour | CTO, CISO, on-call engineer |
| **P2 - Medium** | Non-exploited vulnerability discovered, partial outage | 4 hours | On-call engineer, security team |
| **P3 - Low** | Minor security issue, monitoring alert | 24 hours | Security team |

### Incident Response Procedure

**Phase 1: Detection & Triage (0-15 min)**
1. Alert received (Sentry, Cloudwatch, user report)
2. On-call engineer acknowledges via PagerDuty
3. Initial assessment: severity, scope, affected users
4. Escalate to CISO if P0/P1

**Phase 2: Containment (15 min - 1 hour)**
1. Isolate affected systems (e.g., disable compromised API keys)
2. Block malicious IPs via Cloudflare WAF
3. Revoke leaked credentials (Clerk, AWS IAM)
4. Enable "maintenance mode" if necessary

**Phase 3: Eradication (1-4 hours)**
1. Identify root cause (code review, log analysis)
2. Deploy hotfix (expedited review process)
3. Rotate secrets (database credentials, API keys)
4. Verify fix with monitoring

**Phase 4: Recovery (4-24 hours)**
1. Restore service to normal operation
2. Monitor for anomalies (24-hour watch)
3. Communicate with affected users (if applicable)

**Phase 5: Post-Incident Review (24-72 hours)**
1. Write incident report (timeline, root cause, mitigation)
2. Update runbooks and playbooks
3. Schedule retrospective with team
4. Implement preventive measures

### Breach Notification

**GDPR Requirements** (Article 33):
- Notify supervisory authority within **72 hours** of discovery
- Include: nature of breach, affected records, likely consequences, mitigation

**CCPA Requirements**:
- Notify affected California residents **without undue delay**
- Include: date of breach, types of info compromised, contact info

**Template Email**:
```
Subject: Important Security Notice - Humane Job Application

Dear [Name],

We are writing to inform you of a security incident that may have affected your personal information.

What Happened:
[Brief description of incident]

What Information Was Affected:
[List of data types: email, name, etc.]

What We're Doing:
[Containment and remediation steps]

What You Can Do:
[Recommended actions: reset password, monitor credit, etc.]

Contact:
security@humanejob.com | 1-800-XXX-XXXX

Sincerely,
Humane Job Application Security Team
```

---

## Security Testing

### Static Application Security Testing (SAST)

**Tools**:
- **ESLint** with security rules (eslint-plugin-security)
- **Semgrep** for custom patterns (e.g., detect LLM calls with PII)
- **npm audit** for dependency vulnerabilities

**CI/CD Integration**:
```yaml
# .github/workflows/security.yml
- name: Run SAST
  run: |
    npm audit --audit-level=moderate
    npx semgrep --config=p/owasp-top-ten
    npx eslint --ext .ts,.tsx src/
```

**Fail Criteria**: High/Critical vulnerabilities block PR merge

### Dynamic Application Security Testing (DAST)

**Tools**:
- **OWASP ZAP** (weekly scans against staging)
- **Burp Suite** (manual penetration testing quarterly)

**Scope**:
- API endpoints (injection, auth bypass)
- File uploads (malware, XXE)
- Rate limiting effectiveness

### Dependency Scanning

**Tools**:
- **Snyk** (real-time monitoring)
- **Dependabot** (automated PRs for updates)

**Policy**: Update dependencies within 7 days of CVE disclosure

### Penetration Testing

**Frequency**: Quarterly (external firm)

**Scope**:
- Web application (OWASP Top 10)
- API security (broken auth, IDOR)
- Infrastructure (AWS misconfigurations)

**Report Delivery**: 14 days after test completion

### Bug Bounty Program

**Platform**: HackerOne (launching Q2 2024)

**Scope**:
- Web application (*.humanejob.com)
- API (api.humanejob.com)
- Out of scope: DDoS, social engineering, physical attacks

**Rewards**:
- Critical: $1,000 - $5,000
- High: $500 - $1,000
- Medium: $100 - $500
- Low: $50 - $100

---

## Security Checklist (Pre-Launch)

- [ ] TLS 1.3 enforced, HSTS enabled
- [ ] Clerk authentication configured (passkeys + MFA)
- [ ] RBAC middleware applied to all API routes
- [ ] Rate limiting enabled (three-tier strategy)
- [ ] Input validation (Zod schemas) on all endpoints
- [ ] Output encoding (JSON escaping, CSV sanitization)
- [ ] DLP policy enforced (no PII to LLMs)
- [ ] Database encryption at rest (pgcrypto)
- [ ] S3 bucket encryption (SSE-KMS)
- [ ] Audit logging enabled (all state-changing operations)
- [ ] Cryptographic receipts for decisions
- [ ] Banned phrase filtering in LLM provider
- [ ] Webhook signature verification (ATS integrations)
- [ ] CORS policy (no wildcard origins)
- [ ] Error handling (no stack traces in production)
- [ ] Sentry configured (PII redaction enabled)
- [ ] CSP headers set (restrict script sources)
- [ ] Secrets stored in environment variables (not code)
- [ ] Incident response runbook documented
- [ ] Penetration test scheduled (pre-launch)
- [ ] GDPR compliance verified (privacy policy, consent)
- [ ] Backup strategy (daily snapshots, 30-day retention)
- [ ] Disaster recovery plan (RTO: 4 hours, RPO: 1 hour)

---

## Contact

**Security Team**: security@humanejob.com
**Bug Reports**: https://github.com/humane-job/security/issues
**PGP Key**: https://humanejob.com/.well-known/pgp-key.txt

**Responsible Disclosure**: We appreciate security researchers who report vulnerabilities privately. We commit to:
- Acknowledge receipt within 24 hours
- Provide status updates every 72 hours
- Fix critical issues within 7 days
- Credit researchers (with permission) in our security hall of fame
