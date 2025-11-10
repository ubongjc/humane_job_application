import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Globe, CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function TemplatesPage() {
  const { userId } = await auth();
  const user = await db.user.findUnique({ where: { clerkId: userId! } });

  if (!user) return null;

  const templates = await db.letterTemplate.findMany({
    where: {
      OR: [
        { companyId: user.companyId },
        { companyId: null }, // System templates
      ],
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const jurisdictions = ["US", "EU", "CA"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Letter Templates</h1>
          <p className="mt-2 text-gray-600">
            Customize rejection letter templates for different regions
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Jurisdiction Tabs */}
      <div className="flex space-x-4 border-b">
        {jurisdictions.map((jurisdiction) => (
          <button
            key={jurisdiction}
            className="px-4 py-2 font-medium text-gray-700 border-b-2 border-blue-600"
          >
            <Globe className="w-4 h-4 inline mr-2" />
            {jurisdiction}
          </button>
        ))}
      </div>

      <div className="grid gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-semibold text-gray-900">{template.name}</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {template.jurisdiction}
                  </span>
                  {template.isDefault && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Default
                    </span>
                  )}
                  {!template.companyId && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      System Template
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  Preview
                </Button>
                {template.companyId && (
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {template.template.substring(0, 300)}...
              </pre>
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <span>
                Variables: {Object.keys(template.variables as Record<string, any> || {}).length}
              </span>
              <span>
                Created {new Date(template.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <h3 className="font-semibold text-gray-900 mb-2">Template Variables</h3>
        <p className="text-sm text-gray-700 mb-4">
          Use these variables in your templates. They will be automatically replaced with actual values.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            "{{candidateName}}",
            "{{jobTitle}}",
            "{{companyName}}",
            "{{feedback}}",
            "{{jurisdiction}}",
            "{{interviewDate}}",
            "{{recruiterName}}",
            "{{hiringManager}}",
          ].map((variable) => (
            <code
              key={variable}
              className="px-3 py-2 bg-white border border-yellow-300 rounded text-gray-800"
            >
              {variable}
            </code>
          ))}
        </div>
      </Card>
    </div>
  );
}
