import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type CurrentSession = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  email: string;
  name: string;
};

/** Devuelve la sesión actual (usuario + empresa activa) o null si no hay sesión. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  if (!user.organizationId) return null;

  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}
