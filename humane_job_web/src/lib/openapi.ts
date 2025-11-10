import { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "Humane Job Application API",
    version: "1.0.0",
    description: "API for generating humane, privacy-safe candidate rejections with contextual feedback",
    contact: {
      name: "API Support",
      email: "support@humane-job.com",
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      description: "API Server",
    },
  ],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Jobs", description: "Job management" },
    { name: "Candidates", description: "Candidate management" },
    { name: "Decisions", description: "Hiring decisions and letter generation" },
    { name: "Extension", description: "Browser extension endpoints" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Check API and database health",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" },
                    service: { type: "string" },
                    version: { type: "string" },
                    database: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/jobs": {
      get: {
        tags: ["Jobs"],
        summary: "List jobs",
        description: "Get all jobs for the authenticated company",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "number", default: 20 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "number", default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "List of jobs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Job" },
                    },
                    total: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Jobs"],
        summary: "Create job",
        description: "Create a new job posting",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateJobRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Job created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Job" },
              },
            },
          },
        },
      },
    },
    "/api/jobs/{id}": {
      get: {
        tags: ["Jobs"],
        summary: "Get job",
        description: "Get a specific job by ID",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Job details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Job" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Job: {
        type: "object",
        properties: {
          id: { type: "string" },
          companyId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          rubric: { type: "object" },
          jurisdiction: { type: "string" },
          status: { type: "string", enum: ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateJobRequest: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          rubric: { type: "object" },
          jurisdiction: { type: "string", default: "US" },
        },
      },
    },
  },
};
