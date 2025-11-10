import Papa from "papaparse";

export interface CandidateCSVRow {
  name: string;
  email: string;
  jobId?: string;
  phone?: string;
  resume?: string;
}

export function parseCSV(file: File): Promise<CandidateCSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as CandidateCSVRow[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function generateCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportCandidates(companyId: string, jobId?: string) {
  const url = jobId
    ? `/api/batch/export/candidates?jobId=${jobId}`
    : `/api/batch/export/candidates?companyId=${companyId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to export candidates");
  }

  const data = await response.json();
  generateCSV(data, `candidates-${Date.now()}.csv`);
}

export async function exportDecisions(companyId: string, startDate?: Date, endDate?: Date) {
  const params = new URLSearchParams({ companyId });
  if (startDate) params.append("startDate", startDate.toISOString());
  if (endDate) params.append("endDate", endDate.toISOString());

  const response = await fetch(`/api/batch/export/decisions?${params}`);
  if (!response.ok) {
    throw new Error("Failed to export decisions");
  }

  const data = await response.json();
  generateCSV(data, `decisions-${Date.now()}.csv`);
}

export async function exportAuditLog(companyId: string, startDate?: Date, endDate?: Date) {
  const params = new URLSearchParams({ companyId });
  if (startDate) params.append("startDate", startDate.toISOString());
  if (endDate) params.append("endDate", endDate.toISOString());

  const response = await fetch(`/api/batch/export/audit-log?${params}`);
  if (!response.ok) {
    throw new Error("Failed to export audit log");
  }

  const data = await response.json();
  generateCSV(data, `audit-log-${Date.now()}.csv`);
}
