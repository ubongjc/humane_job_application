# Humane Job Application

A browser extension + HR web app that generates humane, privacy-safe candidate rejections with contextual feedback from interview notes and rubrics; protects brand reputation and improves candidate experience.

## Project Structure

This monorepo contains two main applications:

```
humane_job_application/
├── humane_job_web/          # Next.js 15 web application
│   ├── src/
│   │   ├── app/             # App Router pages and API routes
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities and database client
│   ├── prisma/              # Database schema and migrations
│   └── package.json
│
└── humane_job_extension/    # Browser extension (Manifest V3)
    ├── src/
    │   ├── popup/           # Extension popup UI (React)
    │   ├── background/      # Background service worker
    │   ├── content/         # Content scripts for ATS platforms
    │   └── lib/             # Shared utilities
    ├── manifest.json
    └── package.json
```

## Features

### Web Application
- **Authentication**: Passkey/WebAuthn-first with Clerk, magic links as fallback
- **Role-Based Access Control**: Admin, Hiring Manager, Recruiter, Interviewer roles
- **Job Management**: Create and manage job postings with custom rubrics
- **API**: RESTful API with OpenAPI documentation
- **Privacy-First**: Client-side encryption for sensitive data
- **Audit Logging**: Complete audit trail for compliance
- **Subscription Management**: Stripe integration for billing

### Browser Extension
- **ATS Integration**: Works with Greenhouse, Lever, Workday, Jazz, Breezy
- **Context Extraction**: Reads structured rubric data (not raw resumes)
- **Letter Generation**: AI-powered rejection letters with bias guardrails
- **Privacy-Safe**: Only sends structured evaluation criteria, never full candidate data

## Tech Stack

### Web (humane_job_web)
- **Framework**: Next.js 15, React 18, TypeScript 5
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: PostgreSQL 16 + Prisma 5, pgvector for embeddings
- **Storage**: Cloudflare R2 (S3-compatible)
- **Auth**: Clerk (Passkeys/WebAuthn)
- **Payments**: Stripe
- **Monitoring**: Sentry + OpenTelemetry
- **API**: OpenAPI/Swagger documentation

### Extension (humane_job_extension)
- **Framework**: React 18, TypeScript 5
- **Build**: Webpack 5
- **Browser API**: Manifest V3, webextension-polyfill
- **Validation**: Zod

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 16+
- Stripe account (for payments)
- Clerk account (for authentication)

### Web Application Setup

1. Navigate to the web app directory:
```bash
cd humane_job_web
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template:
```bash
cp .env.example .env
```

4. Update `.env` with your credentials:
   - Database URL
   - Clerk keys
   - Stripe keys
   - Cloudflare R2 credentials
   - OpenAI API key
   - Sentry DSN

5. Set up the database:
```bash
npm run db:push
```

6. Generate Prisma client:
```bash
npm run db:generate
```

7. Run the development server:
```bash
npm run dev
```

The web app will be available at `http://localhost:3000`

### Extension Setup

1. Navigate to the extension directory:
```bash
cd humane_job_extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in your browser:
   - **Chrome**: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `dist` folder
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in the `dist` folder
   - **Edge**: Go to `edge://extensions/`, enable Developer mode, click "Load unpacked", select the `dist` folder

5. For development with auto-reload:
```bash
npm run dev
```

## API Documentation

Once the web app is running, visit:
- OpenAPI Spec: `http://localhost:3000/api/docs`
- Health Check: `http://localhost:3000/api/health`

### Key API Endpoints

- `POST /api/ext/bootstrap` - Extension authentication and scope verification
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/[id]` - Get specific job
- `POST /api/letter/generate` - Generate rejection letter
- `POST /api/letter/send` - Send rejection letter
- `GET /api/audit/export` - Export audit logs

## Database Schema

The application uses a comprehensive schema with the following models:

- **Company**: Organization using the platform
- **User**: Individual users with role-based permissions
- **Job**: Job postings with custom rubrics
- **Candidate**: Job applicants with consent tracking
- **InterviewNote**: Structured feedback from interviews
- **Decision**: Hiring decisions with generated letters
- **ApiKey**: API keys for extension and integrations
- **AuditLog**: Compliance and security tracking
- **Subscription**: Billing and entitlements
- **LetterTemplate**: Customizable rejection templates
- **DataExport**: Data subject request tracking

## Security & Privacy

- **Client-Side Encryption**: Sensitive data encrypted before upload
- **Data Minimization**: Only structured rubric items sent, not raw resumes
- **Bias Guardrails**: AI filters for discrimination/medical inference
- **Jurisdiction-Aware**: Templates for US/EU/CA compliance
- **Audit Trail**: Complete logging for compliance
- **Signed URLs**: Secure file access with expiration
- **API Key Hashing**: Never store plaintext keys

## Development

### Web App Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
```

### Extension Scripts
```bash
npm run dev          # Build with watch mode
npm run build        # Build for production
npm run type-check   # TypeScript type checking
```

## Deployment

### Web App
The Next.js app can be deployed to:
- Vercel (recommended)
- AWS
- Google Cloud Platform
- Self-hosted with Node.js

### Extension
Build and submit to:
- Chrome Web Store
- Firefox Add-ons
- Microsoft Edge Add-ons

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact support@humane-job.com
