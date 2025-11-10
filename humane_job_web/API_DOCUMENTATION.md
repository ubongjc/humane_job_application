# Humane Job Application API Documentation

## Base URL
```
https://api.humane-job.com/api
Development: http://localhost:3000/api
```

## Authentication

All API requests require authentication using Clerk JWT tokens.

```http
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting

- Standard endpoints: 60 requests per minute
- Authentication endpoints: 15 requests per 15 minutes
- Strict endpoints (letter generation): 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2025-01-10T12:00:00Z
```

## Health Check

### GET /health
Check API and database health.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00Z",
  "service": "humane-job-web",
  "version": "0.1.0",
  "database": "connected"
}
```

## Jobs

### GET /jobs
List all jobs for your company.

**Query Parameters**
- `status` (optional): Filter by status (DRAFT, ACTIVE, PAUSED, CLOSED)
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response**
```json
{
  "jobs": [
    {
      "id": "job_123",
      "companyId": "comp_123",
      "title": "Senior Software Engineer",
      "description": "...",
      "rubric": {...},
      "jurisdiction": "US",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 42
}
```

### POST /jobs
Create a new job.

**Request Body**
```json
{
  "title": "Senior Software Engineer",
  "description": "We are looking for...",
  "rubric": {
    "technical_skills": {
      "weight": 0.4,
      "criteria": ["React", "TypeScript", "Node.js"]
    },
    "communication": {
      "weight": 0.3,
      "criteria": ["Clear communication", "Team collaboration"]
    }
  },
  "jurisdiction": "US"
}
```

**Response** `201 Created`
```json
{
  "id": "job_123",
  "companyId": "comp_123",
  "title": "Senior Software Engineer",
  ...
}
```

### GET /jobs/{id}
Get a specific job.

**Response**
```json
{
  "id": "job_123",
  "title": "Senior Software Engineer",
  ...
  "_count": {
    "candidates": 42,
    "decisions": 10
  }
}
```

## Letter Generation

### POST /letter/generate
Generate a rejection letter using AI.

**Request Body**
```json
{
  "candidateId": "cand_123",
  "jobId": "job_123",
  "outcome": "REJECTED",
  "reasons": [
    "While your technical skills are strong, we're looking for more experience with distributed systems",
    "The role requires 5+ years of experience with microservices architecture"
  ],
  "tone": "empathetic",
  "useCustomTemplate": false,
  "templateId": null
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "decisionId": "dec_123",
  "letter": "Dear John,\n\nThank you for taking the time...",
  "biasWarnings": [],
  "biasCheckPassed": true
}
```

**Error Response** `400 Bad Request` (Bias Detected)
```json
{
  "error": "Letter failed bias detection",
  "warnings": [
    "Age-related language detected",
    "Gender-specific language detected"
  ],
  "letter": "..."
}
```

### POST /letter/send
Send a generated rejection letter.

**Request Body**
```json
{
  "decisionId": "dec_123",
  "scheduledFor": "2025-01-15T10:00:00Z",
  "customSubject": "Update on your application",
  "preview": false
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "sentAt": "2025-01-15T10:00:00Z",
  "messageId": "msg_123"
}
```

## Interview Notes

### POST /interview-notes
Create structured interview feedback.

**Request Body**
```json
{
  "jobId": "job_123",
  "candidateEmail": "john@example.com",
  "structuredScores": {
    "technical_skills": 4,
    "communication": 5,
    "problem_solving": 3,
    "culture_fit": 4
  },
  "summary": "Strong technical skills, excellent communicator"
}
```

**Response** `201 Created`
```json
{
  "id": "note_123",
  "jobId": "job_123",
  "candidateEmail": "john@example.com",
  "authorId": "user_123",
  "structuredScores": {...},
  "summary": "...",
  "createdAt": "2025-01-10T12:00:00Z"
}
```

### GET /interview-notes
Get interview notes.

**Query Parameters**
- `jobId` (optional): Filter by job
- `candidateEmail` (optional): Filter by candidate

**Response**
```json
[
  {
    "id": "note_123",
    "jobId": "job_123",
    "candidateEmail": "john@example.com",
    "author": {
      "name": "Jane Doe",
      "email": "jane@company.com"
    },
    "job": {
      "title": "Senior Software Engineer"
    },
    "structuredScores": {...},
    "createdAt": "2025-01-10T12:00:00Z"
  }
]
```

## Data Subject Rights (DSR)

### POST /dsr/request
Create a GDPR/CCPA data request.

**Request Body**
```json
{
  "email": "user@example.com",
  "requestType": "EXPORT",
  "companyId": "comp_123"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "requestId": "dsr_123",
  "status": "PENDING",
  "message": "Your data export will be ready within 30 days"
}
```

## Webhooks

### POST /webhooks/stripe
Handle Stripe subscription events.

**Headers**
```
stripe-signature: t=1234567890,v1=signature
```

**Events Handled**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Batch Operations

### GET /batch/export/candidates
Export candidates as CSV.

**Query Parameters**
- `jobId` (optional): Filter by specific job
- `companyId` (required): Your company ID

**Response**
```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "job": "Senior Software Engineer",
    "jobId": "job_123",
    "appliedAt": "2025-01-01T00:00:00Z",
    "status": "REJECTED",
    "decisionDate": "2025-01-10T00:00:00Z",
    "letterSent": "Yes"
  }
]
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid auth token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Error Response Format
```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

## Webhooks (Outgoing)

Configure webhook URLs in your settings to receive real-time notifications.

### Events
- `decision.created`
- `letter.generated`
- `letter.sent`
- `candidate.applied`
- `interview_note.created`

### Webhook Payload
```json
{
  "event": "letter.sent",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "decisionId": "dec_123",
    "candidateEmail": "john@example.com",
    "jobTitle": "Senior Software Engineer"
  }
}
```

## SDKs

Coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- Ruby SDK

## Support

- Documentation: https://docs.humane-job.com
- API Status: https://status.humane-job.com
- Support Email: support@humane-job.com
