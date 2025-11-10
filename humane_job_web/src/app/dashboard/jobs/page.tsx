import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

export default async function JobsPage() {
  const { userId } = await auth();
  const user = await db.user.findUnique({ where: { clerkId: userId! } });

  if (!user) return null;

  const jobs = await db.job.findMany({
    where: { companyId: user.companyId },
    include: {
      _count: {
        select: { candidates: true, decisions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
          <p className="mt-2 text-gray-600">Manage your job postings and candidates</p>
        </div>
        <Link href="/dashboard/jobs/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
          <option>All Statuses</option>
          <option>Active</option>
          <option>Paused</option>
          <option>Closed</option>
        </select>
      </div>

      <div className="grid gap-6">
        {jobs.map((job) => (
          <Link key={job.id} href={`/dashboard/jobs/${job.id}`}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : job.status === "PAUSED"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-600 line-clamp-2">{job.description}</p>
                  <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                    <span>{job._count.candidates} candidates</span>
                    <span>{job._count.decisions} decisions</span>
                    <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {jobs.length === 0 && (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first job posting to start managing candidates and sending humane rejections
              </p>
              <Link href="/dashboard/jobs/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Job
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
