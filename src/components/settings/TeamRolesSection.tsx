"use client";

import { useState } from "react";
import { Role, User } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  EDITOR: "Can edit",
  VIEWER: "View only",
};

export function TeamRolesSection({
  initialTeam,
  currentUserId,
  isAdmin,
}: {
  initialTeam: User[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, role: Role) {
    setError(null);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Couldn't update role.");
      return;
    }
    setTeam((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Team &amp; roles</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Everyone who has signed in shows up here. Admins can grant or revoke edit access.
      </div>
      {team.length === 0 ? (
        <div className="muted">Nobody has signed in yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td className="name-cell">
                  {u.name || <span className="muted">—</span>} {u.id === currentUserId && <span className="tag brass">you</span>}
                </td>
                <td>{u.email}</td>
                <td>
                  {isAdmin ? (
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}>
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[u.role]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
