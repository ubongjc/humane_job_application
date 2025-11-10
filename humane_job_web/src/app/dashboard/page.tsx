import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Briefcase, Users, FileCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();

  const user = await db.user.findUnique({
    where: { clerkId: userId! },
  });

  if (!user) return null;

  // Get statistics
  const [jobsCount, candidatesCount, decisionsCount, recentDecisions] = await Promise.all([
    db.job.count({
      where: { companyId: user.companyId, status: "ACTIVE" },
    }),
    db.candidate.count({
      where: { job: { companyId: user.companyId } },
    }),
    db.decision.count({
      where: {
        job: { companyId: user.companyId },
        sentAt: { not: null },
      },
    }),
    db.decision.findMany({
      where: { job: { companyId: user.companyId } },
      include: {
        candidate: true,
        job: true,
        author: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = [
    {
      name: "Active Jobs",
      value: jobsCount,
      icon: Briefcase,
      href: "/dashboard/jobs",
      color: "bg-blue-500",
    },
    {
      name: "Total Candidates",
      value: candidatesCount,
      icon: Users,
      href: "/dashboard/candidates",
      color: "bg-green-500",
    },
    {
      name: "Letters Sent",
      value: decisionsCount,
      icon: FileCheck,
      href: "/dashboard/decisions",
      color: "bg-purple-500",
    },
    {
      name: "Success Rate",
      value: "94%",
      icon: TrendingUp,
      href: "/dashboard/analytics",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's an overview of your hiring activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.name} href={stat.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Decisions</h2>
        {recentDecisions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No decisions yet</p>
        ) : (
          <div className="space-y-4">
            {recentDecisions.map((decision) => (
              <div
                key={decision.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {decision.candidate.name || decision.candidate.email}
                  </p>
                  <p className="text-sm text-gray-600">{decision.job.title}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      decision.outcome === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : decision.outcome === "OFFER"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {decision.outcome}
                  </span>
                  <span className="text-sm text-gray-500">
                    {decision.sentAt
                      ? `Sent ${new Date(decision.sentAt).toLocaleDateString()}`
                      : "Draft"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Create New Job</h3>
          <p className="text-sm text-gray-600 mb-4">
            Post a new position and start accepting applications
          </p>
          <Link
            href="/dashboard/jobs/new"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            Get started →
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Manage Templates</h3>
          <p className="text-sm text-gray-600 mb-4">
            Customize your rejection letter templates
          </p>
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            View templates →
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">View Analytics</h3>
          <p className="text-sm text-gray-600 mb-4">
            Track your team's performance and candidate experience
          </p>
          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            See insights →
          </Link>
        </Card>
      </div>
    </div>
  );
}
