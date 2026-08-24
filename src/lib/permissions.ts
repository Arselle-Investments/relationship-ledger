import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

export type SessionUser = { id: string; role: Role; name?: string | null; email?: string | null };

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user) throw new AuthError("Not signed in.", 401);
  return user;
}

export async function requireEditor(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN && user.role !== Role.EDITOR) {
    throw new AuthError("View-only accounts can't make changes.", 403);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN) {
    throw new AuthError("Admin only.", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
