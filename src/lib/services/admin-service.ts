import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";

export class AdminServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_CURRENT_PASSWORD"
  ) {
    super(message);
    this.name = "AdminServiceError";
  }
}

/** Troca a senha do admin logado — exige a senha atual correta antes de gravar a nova. */
export async function changePassword(
  adminId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new AdminServiceError("Administrador não encontrado.", "NOT_FOUND");
  }

  const validCurrentPassword = await verifyPassword(currentPassword, admin.passwordHash);
  if (!validCurrentPassword) {
    throw new AdminServiceError("Senha atual incorreta.", "INVALID_CURRENT_PASSWORD");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.admin.update({ where: { id: adminId }, data: { passwordHash } });
}
