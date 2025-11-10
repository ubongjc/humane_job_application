"use client";

/**
 * 🚀 OPTIMISTIC UI EXAMPLES
 *
 * This file demonstrates how to use optimistic updates throughout the app.
 * Copy these patterns for instant-feeling UX!
 */

import { useOptimistic, optimisticOperations } from "@/hooks/use-optimistic";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Example: Jobs List with Optimistic Updates
interface Job {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
}

export function OptimisticJobsList({ initialJobs }: { initialJobs: Job[] }) {
  const { data: jobs, updateOptimistic, isPending } = useOptimistic<Job[]>(initialJobs);

  const handleCreateJob = async (newJob: Omit<Job, "id">) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticJob = { ...newJob, id: tempId };

    await updateOptimistic(
      // 1. Optimistic update - UI updates INSTANTLY
      (currentJobs) => optimisticOperations.add(currentJobs, optimisticJob),

      // 2. Actual API call - happens in background
      async () => {
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newJob),
        });

        if (!response.ok) throw new Error("Failed to create job");

        const realJob = await response.json();

        // Replace temp ID with real ID
        return realJob;
      },

      // 3. Callbacks
      {
        onSuccess: (realJob) => {
          toast.success(`Job "${realJob.title}" created!`);

          // Update the temp job with real data
          updateOptimistic(
            (currentJobs) =>
              currentJobs.map((j) => (j.id === tempId ? realJob : j)),
            async () => Promise.resolve(realJob),
            { revertDelay: 0 }
          );
        },
        onError: (error) => {
          toast.error("Failed to create job. Changes reverted.");
          console.error(error);
        },
        revertDelay: 500, // Show error toast for 500ms before reverting
      }
    );
  };

  const handleDeleteJob = async (jobId: string) => {
    await updateOptimistic(
      // Instantly remove from UI
      (currentJobs) => optimisticOperations.remove(currentJobs, (j) => j.id === jobId),

      // Actual delete
      async () => {
        const response = await fetch(`/api/jobs/${jobId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete job");
        return response.json();
      },

      {
        onSuccess: () => toast.success("Job deleted"),
        onError: () => toast.error("Failed to delete. Restored."),
      }
    );
  };

  const handleToggleStatus = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const newStatus = job.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    await updateOptimistic(
      // Instantly toggle status
      (currentJobs) =>
        optimisticOperations.update(
          currentJobs,
          (j) => j.id === jobId,
          { status: newStatus }
        ),

      // Actual update
      async () => {
        const response = await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) throw new Error("Failed to update job");
        return response.json();
      },

      {
        onSuccess: () => toast.success(`Job ${newStatus.toLowerCase()}`),
        onError: () => toast.error("Failed to update. Reverted."),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Jobs</h2>
        <Button
          onClick={() =>
            handleCreateJob({
              title: "Senior Developer",
              status: "DRAFT",
            })
          }
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create Job"}
        </Button>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <h3 className="font-semibold">{job.title}</h3>
              <span className="text-sm text-gray-500">{job.status}</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleStatus(job.id)}
              >
                Toggle Status
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeleteJob(job.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example: Decision Updates with Optimistic UI
interface Decision {
  id: string;
  outcome: "REJECTED" | "ACCEPTED";
  sentAt: Date | null;
}

export function useOptimisticDecision(initialDecision: Decision) {
  const { data: decision, updateOptimistic } = useOptimistic<Decision>(initialDecision);

  const sendLetter = async () => {
    await updateOptimistic(
      // Instantly show as sent
      (current) => ({
        ...current,
        sentAt: new Date(),
      }),

      // Actual send
      async () => {
        const response = await fetch(`/api/letter/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisionId: decision.id }),
        });

        if (!response.ok) throw new Error("Failed to send");
        return response.json();
      },

      {
        onSuccess: () => toast.success("✅ Letter sent!"),
        onError: () => toast.error("Failed to send letter"),
      }
    );
  };

  return { decision, sendLetter };
}

// Example: Candidate Pipeline with Drag & Drop
interface Candidate {
  id: string;
  name: string;
  stage: "SCREENING" | "INTERVIEW" | "DECISION";
}

export function useOptimisticCandidates(initialCandidates: Candidate[]) {
  const { data: candidates, updateOptimistic } = useOptimistic<Candidate[]>(
    initialCandidates
  );

  const moveCandidate = async (
    candidateId: string,
    newStage: Candidate["stage"]
  ) => {
    await updateOptimistic(
      // Instantly move in UI
      (current) =>
        optimisticOperations.update(
          current,
          (c) => c.id === candidateId,
          { stage: newStage }
        ),

      // Actual API update
      async () => {
        const response = await fetch(`/api/candidates/${candidateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: newStage }),
        });

        if (!response.ok) throw new Error("Failed to move candidate");
        return response.json();
      },

      {
        onSuccess: () => toast.success("Candidate moved"),
        onError: () => toast.error("Failed to move. Reverted."),
      }
    );
  };

  return { candidates, moveCandidate };
}

/**
 * 💡 BEST PRACTICES:
 *
 * 1. Always show instant feedback (optimistic update)
 * 2. Always handle errors gracefully (automatic rollback)
 * 3. Show toast notifications for success/error
 * 4. Use temporary IDs for new items (replace on success)
 * 5. Keep API calls simple and idempotent
 * 6. Consider revertDelay for better error UX
 *
 * Result: App feels INSTANT with ZERO stress! ⚡️
 */
