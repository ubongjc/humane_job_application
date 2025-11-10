"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Search, Filter } from "lucide-react";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch candidates
    // This would be implemented with actual API calls
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Candidates</h1>
          <p className="mt-2 text-gray-600">Manage your candidate pipeline</p>
        </div>
        <Button>
          <Users className="w-4 h-4 mr-2" />
          Import Candidates
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search candidates..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {["Applied", "Screening", "Interview", "Decision"].map((stage) => (
          <Card key={stage} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">{stage}</h3>
              <span className="text-sm text-gray-500">0</span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center text-sm text-gray-500">
                No candidates
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
