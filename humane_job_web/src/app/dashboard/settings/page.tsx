import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Users, CreditCard, Shield, Bell } from "lucide-react";

export default async function SettingsPage() {
  const { userId } = await auth();
  const user = await db.user.findUnique({
    where: { clerkId: userId! },
    include: {
      company: {
        include: {
          subscriptions: {
            where: { status: { in: ["ACTIVE", "TRIAL"] } },
            take: 1,
          },
        },
      },
    },
  });

  if (!user) return null;

  const subscription = user.company.subscriptions[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account and company settings
        </p>
      </div>

      {/* Company Info */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Company Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              defaultValue={user.company.name}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Domain
            </label>
            <input
              type="text"
              defaultValue={user.company.domain}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="mt-6">
          <Button>Save Changes</Button>
        </div>
      </Card>

      {/* Team Members */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold">Team Members</h2>
          </div>
          <Button size="sm">Invite User</Button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user.role}
              </span>
              <span className="text-xs text-gray-500">You</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Subscription */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <CreditCard className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Subscription</h2>
        </div>
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg mb-4">
          <div>
            <p className="font-semibold text-gray-900">{user.company.tier} Plan</p>
            <p className="text-sm text-gray-600">
              {subscription?.status === "TRIAL"
                ? `Trial ends ${new Date(subscription.currentPeriodEnd!).toLocaleDateString()}`
                : `Next billing: ${subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}`}
            </p>
          </div>
          <Button variant="outline">Manage</Button>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Bell className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: "Email notifications for new decisions", checked: true },
            { label: "Weekly summary emails", checked: true },
            { label: "Browser notifications", checked: false },
            { label: "Bias check alerts", checked: true },
          ].map((notification) => (
            <label
              key={notification.label}
              className="flex items-center space-x-3 cursor-pointer"
            >
              <input
                type="checkbox"
                defaultChecked={notification.checked}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{notification.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Security & Privacy</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-sm text-gray-600">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">API Keys</p>
              <p className="text-sm text-gray-600">Manage API access</p>
            </div>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Audit Logs</p>
              <p className="text-sm text-gray-600">View all account activity</p>
            </div>
            <Button variant="outline" size="sm">
              View Logs
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
