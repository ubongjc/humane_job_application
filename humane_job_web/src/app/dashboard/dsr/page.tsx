import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Download, Trash2, Shield } from "lucide-react";

export default async function DSRPortalPage() {
  const { userId } = await auth();
  const user = await db.user.findUnique({ where: { clerkId: userId! } });

  if (!user) return null;

  const requests = await db.dataExport.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Data Subject Rights Portal</h1>
        <p className="mt-2 text-gray-600">
          Manage GDPR/CCPA data access and deletion requests
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{requests.length}</div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {requests.filter((r) => r.requestType === "EXPORT").length}
              </div>
              <div className="text-sm text-gray-600">Export Requests</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 p-3 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {requests.filter((r) => r.requestType === "DELETE").length}
              </div>
              <div className="text-sm text-gray-600">Delete Requests</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Requests</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          request.requestType === "EXPORT"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {request.requestType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          request.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : request.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.expiresAt
                        ? new Date(request.expiresAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-2">Compliance Information</h3>
        <p className="text-sm text-gray-700 mb-4">
          This portal helps you comply with GDPR, CCPA, and other data protection regulations.
          All requests are logged and tracked for audit purposes.
        </p>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Export requests are completed within 30 days</li>
          <li>• Delete requests are reviewed and processed within 30 days</li>
          <li>• All actions are logged in your audit trail</li>
          <li>• Exported data expires after 7 days for security</li>
        </ul>
      </Card>
    </div>
  );
}
