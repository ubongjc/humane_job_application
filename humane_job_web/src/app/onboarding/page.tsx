"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    companyDomain: "",
    tier: "FREE" as const,
    role: "ADMIN" as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to complete onboarding");
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Onboarding error:", error);
      alert("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Humane Job Application
            </h1>
            <p className="text-gray-600">
              Let's set up your account in just a few steps
            </p>
          </div>

          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex items-center ${s < 3 ? "flex-1" : ""}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= s
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`h-1 flex-1 mx-2 ${
                        step > s ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className={step >= 1 ? "text-blue-600" : "text-gray-500"}>
                Company Info
              </span>
              <span className={step >= 2 ? "text-blue-600" : "text-gray-500"}>
                Your Role
              </span>
              <span className={step >= 3 ? "text-blue-600" : "text-gray-500"}>
                Subscription
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Company Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    placeholder="Acme Inc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Domain
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.companyDomain}
                    onChange={(e) =>
                      setFormData({ ...formData, companyDomain: e.target.value })
                    }
                    placeholder="acme.com"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Used for email verification and branding
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full"
                  disabled={!formData.companyName || !formData.companyDomain}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Role Selection */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    What's your role?
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { value: "ADMIN", label: "Admin", desc: "Full access" },
                      { value: "HIRING_MANAGER", label: "Hiring Manager", desc: "Manage jobs & decisions" },
                      { value: "RECRUITER", label: "Recruiter", desc: "Manage candidates" },
                      { value: "INTERVIEWER", label: "Interviewer", desc: "Submit feedback" },
                    ].map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, role: role.value as any })
                        }
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          formData.role === role.value
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-semibold">{role.label}</div>
                        <div className="text-sm text-gray-600">{role.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Subscription */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Choose your plan
                  </label>
                  <div className="space-y-4">
                    {[
                      { value: "FREE", label: "Free", price: "$0", desc: "Up to 10 candidates/month" },
                      { value: "STARTER", label: "Starter", price: "$29", desc: "Up to 100 candidates/month" },
                      { value: "PROFESSIONAL", label: "Professional", price: "$99", desc: "Unlimited candidates" },
                      { value: "ENTERPRISE", label: "Enterprise", price: "Custom", desc: "Custom features & support" },
                    ].map((tier) => (
                      <button
                        key={tier.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, tier: tier.value as any })
                        }
                        className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                          formData.tier === tier.value
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{tier.label}</div>
                            <div className="text-sm text-gray-600">{tier.desc}</div>
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {tier.price}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    14-day free trial • No credit card required
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? "Setting up..." : "Complete Setup"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
