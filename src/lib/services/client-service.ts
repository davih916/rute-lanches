import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function getClientProfile(clienteId: string) {
  return prisma.cliente.findUnique({ where: { id: clienteId } });
}

export async function changeClientPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.clienteUsuario.findUnique({ where: { id: userId } });
  if (!user || !user.ativo) throw new Error("Usuário não encontrado.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new Error("A senha atual está incorreta.");
  await prisma.clienteUsuario.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), deveAlterarSenha: false } });
}
