import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validations/category";

export class CategoryServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "HAS_PRODUCTS"
  ) {
    super(message);
    this.name = "CategoryServiceError";
  }
}

/** Gera um slug único, adicionando sufixo numérico em caso de colisão de nome. */
async function uniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (
    await prisma.category.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })
  ) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

export async function listCategoriesForAdmin() {
  return prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

/** Categorias ativas + produtos/adicionais ativos — cardápio público e a tela "Nova Venda" do admin. */
export async function listActiveCategoriesWithProducts() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { order: "asc" },
        include: {
          addons: { where: { active: true } },
        },
      },
    },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = await uniqueCategorySlug(input.name);
  const maxOrder = await prisma.category.aggregate({ _max: { order: true } });

  return prisma.category.create({
    data: { name: input.name, slug, order: (maxOrder._max.order ?? -1) + 1 },
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new CategoryServiceError("Categoria não encontrada.", "NOT_FOUND");
  }

  const slug =
    input.name && input.name !== existing.name
      ? await uniqueCategorySlug(input.name, id)
      : undefined;

  return prisma.category.update({
    where: { id },
    data: { ...input, ...(slug ? { slug } : {}) },
  });
}

/** Só permite excluir categorias sem nenhum produto (mesmo inativo) — evita violar a FK restritiva. */
export async function deleteCategory(id: string): Promise<void> {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) {
    throw new CategoryServiceError("Categoria não encontrada.", "NOT_FOUND");
  }
  if (existing._count.products > 0) {
    throw new CategoryServiceError(
      "Esta categoria tem produtos cadastrados. Mova ou exclua os produtos antes, ou apenas desative a categoria.",
      "HAS_PRODUCTS"
    );
  }
  await prisma.category.delete({ where: { id } });
}
