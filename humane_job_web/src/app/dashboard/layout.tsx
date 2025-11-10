import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardFeatures } from "@/components/dashboard-features";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if user has completed onboarding
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      company: true,
    },
  });

  if (!user) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav user={user} company={user.company} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Dashboard Features: AI Copilot, Command Palette, Keyboard Shortcuts */}
      <DashboardFeatures context={{ page: "dashboard" }} />
    </div>
  );
}
