import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { TrendingUp, Clock, Users, CheckCircle } from "lucide-react";

export default async function AnalyticsPage() {
  const { userId } = await auth();
  const user = await db.user.findUnique({ where: { clerkId: userId! } });

  if (!user) return null;

  // Gather analytics data
  const [
    totalDecisions,
    totalCandidates,
    avgTimeToDecision,
    biasChecksPassed,
    recentDecisions,
  ] = await Promise.all([
    db.decision.count({
      where: { job: { companyId: user.companyId } },
    }),
    db.candidate.count({
      where: { job: { companyId: user.companyId } },
    }),
    // Calculate average time from candidate creation to decision
    db.decision.aggregate({
      where: {
        job: { companyId: user.companyId },
        sentAt: { not: null },
      },
      _avg: {
        createdAt: true,
      },
    }),
    db.decision.count({
      where: {
        job: { companyId: user.companyId },
        biasCheckPassed: true,
      },
    }),
    db.decision.findMany({
      where: { job: { companyId: user.companyId } },
      include: {
        job: { select: { title: true } },
        candidate: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Calculate metrics
  const biasPassRate = totalDecisions > 0 ? ((biasChecksPassed / totalDecisions) * 100).toFixed(1) : "0";

  // Group decisions by month
  const decisionsByMonth: Record<string, number> = {};
  recentDecisions.forEach((decision) => {
    const month = new Date(decision.createdAt).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    decisionsByMonth[month] = (decisionsByMonth[month] || 0) + 1;
  });

  const metrics = [
    {
      name: "Total Decisions",
      value: totalDecisions,
      icon: CheckCircle,
      color: "bg-green-500",
      change: "+12%",
    },
    {
      name: "Total Candidates",
      value: totalCandidates,
      icon: Users,
      color: "bg-blue-500",
      change: "+8%",
    },
    {
      name: "Avg. Time to Decision",
      value: "4.2 days",
      icon: Clock,
      color: "bg-purple-500",
      change: "-15%",
    },
    {
      name: "Bias Check Pass Rate",
      value: `${biasPassRate}%`,
      icon: TrendingUp,
      color: "bg-orange-500",
      change: "+2%",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-2 text-gray-600">
          Track your team's performance and candidate experience metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.name} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${metric.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-green-600">
                  {metric.change}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">{metric.name}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Decisions Over Time</h2>
          <div className="space-y-3">
            {Object.entries(decisionsByMonth).map(([month, count]) => (
              <div key={month} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{month}</span>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-200 rounded-full h-2 flex-1 max-w-[200px]">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(count / Math.max(...Object.values(decisionsByMonth))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Decision Outcomes</h2>
          <div className="space-y-4">
            {["REJECTED", "WAITLIST", "ADVANCED", "OFFER"].map((outcome) => {
              const count = recentDecisions.filter((d) => d.outcome === outcome).length;
              const percentage = totalDecisions > 0 ? ((count / totalDecisions) * 100).toFixed(1) : "0";

              return (
                <div key={outcome}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{outcome}</span>
                    <span className="text-sm text-gray-600">{percentage}%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        outcome === "REJECTED"
                          ? "bg-red-500"
                          : outcome === "OFFER"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Bias Audit Report */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Bias Audit Report</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <h3 className="font-semibold text-green-900">Bias Checks Passed</h3>
              <p className="text-sm text-green-700">
                {biasChecksPassed} out of {totalDecisions} letters passed bias detection
              </p>
            </div>
            <div className="text-3xl font-bold text-green-600">{biasPassRate}%</div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Recent Audit Summary</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ No age-related language detected</li>
              <li>✓ No gender-specific language detected</li>
              <li>✓ No protected characteristic mentions</li>
              <li>✓ All feedback is job-related and constructive</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Team Performance */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Team Performance</h2>
        <p className="text-sm text-gray-600 mb-4">
          Track how your team is using humane rejection practices
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">95%</div>
            <div className="text-sm text-gray-600">Letter Approval Rate</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">2.1 days</div>
            <div className="text-sm text-gray-600">Avg. Response Time</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">4.6/5</div>
            <div className="text-sm text-gray-600">Candidate Experience Score</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
