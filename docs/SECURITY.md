# Security Architecture & Threat Model

## Overview

This document describes the security architecture, threat analysis (STRIDE + LINDDUN), and mitigation strategies for the Humane Job Application platform.

## Table of Contents

1. [Security Principles](#security-principles)
2. [STRIDE Threat Model](#stride-threat-model)
3. [LINDDUN Privacy Threats](#linddun-privacy-threats)
4. [Data Loss Prevention (DLP)](#data-loss-prevention-dlp)
5. [Authentication & Authorization](#authentication--authorization)
6. [Data Protection](#data-protection)
7. [API Security](#api-security)
8. [Third-Party Integrations](#third-party-integrations)
9. [Incident Response](#incident-response)

---

## Security Principles

### Core Tenets

1. **Zero Trust** - Never trust, always verify
2. **Defense in Depth** - Multiple layers of security controls
3. **Least Privilege** - Minimal access rights for all users/systems
4. **Privacy by Design** - Privacy built into every feature
5. **Fail Securely** - System fails to a secure state
6. **Audit Everything** - Comprehensive logging and monitoring

### Compliance Standards

- **GDPR** (EU General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **EEOC** (Equal Employment Opportunity Commission guidelines)
- **SOC 2 Type II** (Security, Availability, Confidentiality)
- **HIPAA** (Health data is NEVER collected/processed)

---

## STRIDE Threat Model

### 1. Spoofing (Identity)

**Threats:**
- Attacker impersonates legitimate user
- ATS webhook spoofing
- Email spoofing for rejection letters

**Mitigations:**
- ✅ Clerk authentication with WebAuthn/Passkeys
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ SPF/DKIM/DMARC for email sending
- ✅ Multi-factor authentication (MFA) required for admins
- ✅ Session management with secure cookies (httpOnly, sameSite, secure)

### 2. Tampering (Data Integrity)

**Threats:**
- Modification of rejection letters post-generation
- Tampering with audit logs
- Modification of rubric scores

**Mitigations:**
- ✅ Cryptographic receipts (SHA-256 + HMAC) for all decisions
- ✅ Immutable audit logs (append-only)
- ✅ Database constraints and foreign keys
- ✅ Input sanitization (DOMPurify, SQL injection prevention)
- ✅ Template version tracking
- ✅ Explainable Feedback Cards with tamper-evident hashing

### 3. Repudiation (Non-Repudiation)

**Threats:**
- User denies performing action
- Dispute over decision timeline
- Lack of proof for compliance audits

**Mitigations:**
- ✅ Comprehensive audit logging (who, what, when, where, why)
- ✅ IP address and user agent logging
- ✅ Cryptographic signatures on decision receipts
- ✅ Timestamps on all operations
- ✅ Export audit trail for compliance

### 4. Information Disclosure (Confidentiality)

**Threats:**
- Unauthorized access to candidate PII
- Exposure of interview notes
- Leakage of rubric criteria
- Cross-tenant data access

**Mitigations:**
- ✅ Role-Based Access Control (RBAC): Admin, Hiring Manager, Recruiter, Interviewer
- ✅ Row-Level Security (RLS) via companyId checks
- ✅ Encryption at rest (database-level)
- ✅ Encryption in transit (TLS 1.3)
- ✅ API key scoping and rotation
- ✅ Rate limiting (3-tier: 60/min, 15/15min, 10/min)
- ✅ Redis cache access control
- ✅ S3 bucket policies (private by default)

### 5. Denial of Service (Availability)

**Threats:**
- API rate limit exhaustion
- LLM timeout attacks
- Bulk operation resource exhaustion
- Database connection pool exhaustion

**Mitigations:**
- ✅ Three-tier rate limiting (per-user, per-IP, per-endpoint)
- ✅ LLM timeout enforcement (max 60s)
- ✅ Token budget limits (max 4k tokens)
- ✅ Bulk operation limits (max 500 candidates)
- ✅ Database connection pooling with limits
- ✅ Redis fallback to in-memory cache
- ✅ Idempotency keys prevent duplicate processing
- ✅ Circuit breakers for external services
- ✅ Cloudflare DDoS protection (recommended)

### 6. Elevation of Privilege (Authorization)

**Threats:**
- Recruiter accessing admin functions
- Cross-company data access
- API key privilege escalation

**Mitigations:**
- ✅ RBAC enforcement at API layer
- ✅ companyId validation on all queries
- ✅ API key scoping (read-only, write, admin)
- ✅ Admin-only routes protected
- ✅ Clerk role-based permissions
- ✅ Feature flags per-tenant

---

## LINDDUN Privacy Threats

### 1. Linking (Correlation)

**Threats:**
- Linking candidate data across applications
- Cross-referencing with external data sources

**Mitigations:**
- ✅ Unique IDs per application (no SSN, no passport numbers)
- ✅ Email is only consistent identifier
- ✅ PII hashing for anonymization (one-way)
- ✅ No resume content stored (only S3 URL)

### 2. Identifying (De-anonymization)

**Threats:**
- Re-identification from rubric scores
- Inference from rejection reasons

**Mitigations:**
- ✅ Aggregated scores only (no individual interviewer attribution)
- ✅ Bias detection prevents protected class inference
- ✅ Template linting blocks identifying language
- ✅ Explainable Feedback Cards contain only job-related criteria

### 3. Non-Repudiation (Proof of Action)

**Threats:**
- Candidate cannot prove rejection was sent
- Company cannot prove letter content

**Mitigations:**
- ✅ Email message IDs tracked
- ✅ Cryptographic receipts for decisions
- ✅ Audit logs with timestamps
- ✅ Appeals system provides proof of communication

### 4. Detectability (Observation)

**Threats:**
- Monitoring candidate portal access
- Tracking appeal submissions

**Mitigations:**
- ✅ Appeals are candidate-initiated (not pushed)
- ✅ No tracking pixels in emails
- ✅ Minimal logging of candidate actions
- ✅ GDPR-compliant data retention policies

### 5. Disclosure of Information

**Threats:**
- Unauthorized access to candidate data
- Data breach

**Mitigations:**
- ✅ Same as STRIDE #4 (Information Disclosure)
- ✅ Data Subject Rights (DSR) portal for access requests
- ✅ Export/delete on demand
- ✅ 30-day SLA for DSR requests

### 6. Unawareness (Lack of Transparency)

**Threats:**
- Candidates unaware of data collection
- No explanation for rejection

**Mitigations:**
- ✅ **Explainable Feedback Cards** - transparent rubric deltas
- ✅ Appeals process allows clarification
- ✅ Privacy policy provided to all candidates
- ✅ Consent flags tracked
- ✅ DSR portal for data review

### 7. Non-Compliance

**Threats:**
- GDPR/CCPA violations
- EEOC discrimination

**Mitigations:**
- ✅ Comprehensive bias detection (10+ categories, 30+ patterns)
- ✅ Jurisdiction-specific rules (US/EU/CA)
- ✅ Template guardrails
- ✅ Audit trail for compliance
- ✅ Regular fairness testing suite

---

## Data Loss Prevention (DLP)

### Critical Policy: NEVER Send Resumes to LLMs

**Rationale:**
- Resumes contain massive amounts of PII (name, address, phone, email, SSN, etc.)
- LLMs have data retention/training concerns
- GDPR Article 5(1)(c): Data minimization
- Potential for PII leakage in model outputs

**Enforcement:**

```typescript
// ❌ NEVER DO THIS
const prompt = `Review this resume: ${resumeText}`;

// ✅ ONLY USE STRUCTURED DATA
const prompt = `
Candidate rubric scores:
- Technical Skills: 3.2/5.0
- Communication: 4.0/5.0
- Problem Solving: 3.5/5.0
`;
```

**Technical Controls:**
- Resume files stored in S3 only (never in database)
- S3 bucket is private (no public access)
- Resume URLs are pre-signed with 15-minute expiration
- LLM prompts contain ONLY rubric-derived data
- Banned phrase filter prevents PII leakage

### Other DLP Policies

1. **No Health Information** - HIPAA applies even if we're not a covered entity
2. **No Financial Data** - Credit scores, bank accounts, etc.
3. **No Government IDs** - SSN, passport, driver's license
4. **No Biometric Data** - Photos, fingerprints, voice recordings
5. **No Criminal History** - Unless legally required for role

---

## Authentication & Authorization

### Authentication (Who are you?)

**Clerk Integration:**
- Email/password (bcrypt, 10 rounds)
- Magic links (email-based, 15-minute expiration)
- Social OAuth (Google, Microsoft)
- WebAuthn/Passkeys (FIDO2)
- Multi-factor authentication (TOTP, SMS)

**Session Management:**
- JWT tokens (1-hour expiration)
- Refresh tokens (7-day expiration)
- Secure cookies (httpOnly, sameSite=strict, secure)
- Automatic session revocation on logout
- Concurrent session limits

### Authorization (What can you do?)

**Role-Based Access Control (RBAC):**

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to company settings, feature flags, billing, user management |
| **Hiring Manager** | Create jobs, view all candidates, generate/send letters, manage templates |
| **Recruiter** | View assigned jobs, add candidates, create interview notes |
| **Interviewer** | View assigned candidates, submit interview notes (read-only otherwise) |

**API Key Scoping:**
- `read:candidates` - Read candidate data
- `write:candidates` - Create/update candidates
- `generate:letters` - Generate rejection letters
- `send:letters` - Send emails
- `admin:*` - Full admin access

---

## Data Protection

### Encryption

**At Rest:**
- PostgreSQL database: AES-256 encryption (managed by cloud provider)
- S3 buckets: AES-256 server-side encryption (SSE-S3)
- Redis cache: Encrypted (TLS + authentication)
- Backups: Encrypted with separate keys

**In Transit:**
- TLS 1.3 for all HTTPS traffic
- Certificate pinning for API clients
- Redis connections use TLS
- Database connections use TLS

### Data Minimization

**What We Collect:**
- ✅ Candidate: Email, name (optional), rubric scores, consent flags
- ✅ Interview Notes: Structured scores, summary (no raw transcripts)
- ✅ Decisions: Rejection reasons, letter content, timestamps

**What We DON'T Collect:**
- ❌ Resume content (stored in S3, not parsed)
- ❌ SSN, passport, government IDs
- ❌ Health information
- ❌ Financial data
- ❌ Photos, videos, biometrics
- ❌ Location tracking
- ❌ Browser fingerprints

### Data Retention

- **Active Candidates:** Until decision is made + 30 days
- **Rejected Candidates:** 1 year (for appeals, compliance)
- **Audit Logs:** 7 years (for legal compliance)
- **Explainable Receipts:** Permanent (cryptographic proof)
- **Interview Notes:** 1 year
- **Emails:** Message IDs only (not content)

### Data Deletion

**DSR Portal:**
1. Candidate requests deletion
2. Email verification
3. 30-day processing SLA
4. Anonymize data (cannot be reversed)
5. Retain audit logs (legal requirement)
6. Send confirmation email

---

## API Security

### Rate Limiting

**Three-Tier System:**
1. **General API:** 60 requests/minute per user
2. **Auth Endpoints:** 15 requests/15 minutes per IP
3. **Strict Endpoints:** 10 requests/minute (letter generation, bulk send)

**Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

### Input Validation

**Zod Schemas:**
- All API endpoints use Zod for schema validation
- Type-safe at compile time and runtime
- Automatic error messages

**Sanitization:**
- XSS prevention: DOMPurify
- SQL injection: Prisma ORM (parameterized queries)
- NoSQL injection: N/A (PostgreSQL only)
- Path traversal: Validated file paths

### Idempotency

**All State-Changing Operations:**
- `Idempotency-Key` header required
- UUID or custom format: `prefix:hash`
- 24-hour cache
- Duplicate requests return cached result
- Prevents double-send, double-charge, etc.

---

## Third-Party Integrations

### LLM Providers (OpenAI)

**Security Controls:**
- API keys stored in environment variables (not in code)
- Rotation every 90 days
- Timeout enforcement (max 60s)
- Token budget limits (max 4k tokens)
- Banned phrase filtering (no PII leakage)
- Fallback provider (automatic retry with different model)
- No training on our data (OpenAI API terms)

**Data Sent:**
- ✅ Rubric scores (aggregated, anonymized)
- ✅ Job title, company name
- ✅ Tone preferences
- ❌ Candidate names (replaced with "Candidate" in prompts)
- ❌ Email addresses
- ❌ Resume content
- ❌ Any PII

### ATS Integrations (Greenhouse, Lever, etc.)

**Webhook Security:**
- HMAC-SHA256 signature verification
- Timestamp validation (5-minute window)
- IP whitelist (optional)
- Request replay prevention
- Rate limiting per webhook source

**API Keys:**
- Encrypted at rest
- Scoped permissions (read-only)
- Automatic rotation every 90 days
- Audit log on key usage

### Email Provider (Nodemailer/SendGrid)

**Security:**
- API keys encrypted
- TLS required
- SPF/DKIM/DMARC configured
- No tracking pixels
- Unsubscribe link required
- Rate limiting (prevent spam)

---

## Incident Response

### Security Incident Classification

**P0 (Critical):**
- Data breach (PII exposed)
- Unauthorized access to production database
- RCE (Remote Code Execution)
- DDoS attack causing full outage

**P1 (High):**
- Privilege escalation
- API key compromise
- Partial service outage
- XSS/CSRF vulnerability

**P2 (Medium):**
- Rate limit bypass
- Information disclosure (non-PII)
- Session fixation

**P3 (Low):**
- Verbose error messages
- Missing security headers
- Outdated dependencies

### Response Procedures

1. **Detect:** Sentry alerts, log monitoring, user reports
2. **Assess:** Severity, scope, affected users
3. **Contain:** Disable affected features, revoke keys, block IPs
4. **Eradicate:** Patch vulnerability, rotate credentials
5. **Recover:** Restore service, verify fix
6. **Notify:** Affected users (GDPR 72-hour requirement), authorities if required
7. **Post-Mortem:** Root cause analysis, prevention strategies

### Breach Notification

**GDPR Requirements:**
- 72 hours to notify supervisory authority
- "Without undue delay" to affected individuals
- Include nature of breach, consequences, mitigation steps

**CCPA Requirements:**
- "Without unreasonable delay"
- Include types of PII involved

---

## Security Testing

### Automated

- ✅ **SAST:** ESLint security rules, Semgrep
- ✅ **Dependency Scanning:** npm audit, Snyk
- ✅ **Container Scanning:** Trivy (Docker images)
- ✅ **Secrets Detection:** GitGuardian, GitHub secret scanning

### Manual

- 📅 **Penetration Testing:** Annually (external firm)
- 📅 **Code Review:** All PRs require security review
- 📅 **Threat Modeling:** Updated quarterly

---

## Security Checklist (Pre-Deployment)

- [ ] All secrets in environment variables (not hardcoded)
- [ ] TLS certificates valid
- [ ] Rate limiting enabled
- [ ] CORS configured (restrictive origins)
- [ ] Security headers set (CSP, HSTS, X-Frame-Options)
- [ ] Database backups automated
- [ ] Audit logging enabled
- [ ] Error messages sanitized (no stack traces in production)
- [ ] Sentry monitoring configured
- [ ] Webhook signatures verified
- [ ] API keys rotated
- [ ] Dependencies updated (no known CVEs)
- [ ] Privacy policy published
- [ ] GDPR/CCPA compliance verified

---

## Contact

**Security Issues:** security@humane-job.com
**Privacy Questions:** privacy@humane-job.com
**Bug Bounty:** https://bugcrowd.com/humane-job
