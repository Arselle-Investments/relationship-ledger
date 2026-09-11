"use client";

export type ExportLogEntry = {
  id: string;
  kind: string;
  fileName: string;
  recordCount: number;
  skippedCount: number;
  createdByName: string | null;
  createdAt: string | Date;
};

const KIND_LABELS: Record<string, string> = {
  "contacts-new": "New contacts",
  "contacts-changes": "Contact changes",
  "companies-new": "New companies",
};

export function ExportLogTable({ logs }: { logs: ExportLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing exported yet</h3>
        <div>Every export run from this page will show up here.</div>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Export</th>
          <th>By</th>
          <th>Records</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="muted">{new Date(log.createdAt).toLocaleString()}</td>
            <td>{KIND_LABELS[log.kind] ?? log.kind}</td>
            <td className="muted">{log.createdByName || "—"}</td>
            <td className="muted">
              {log.recordCount}
              {log.skippedCount > 0 ? ` (${log.skippedCount} held back — no email)` : ""}
            </td>
            <td onClick={(e) => e.stopPropagation()}>
              <a className="btn small" href={`/api/agora-export-log/${log.id}`}>
                Redownload
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
