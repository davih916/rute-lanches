import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import { deleteProductImageIfLocal } from "@/lib/services/upload-service";
import type { ProductInput } from "@/lib/validations/product";

export class ProductServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "CATEGORY_NOT_FOUND" | "IN_USE"
  ) {
    super(message);
    this.name = "ProductServiceError";
  }
}

/** Slug prefixado pela categoria (ver HANDOFF §4) — evita colisão entre pratos com o mesmo nome em categorias diferentes. */
async function uniqueProductSlug(
  categorySlug: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = `${categorySlug}-${slugify(name)}`;
  let slug = base;
  let suffix = 2;
  while (
    await prisma.product.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    })
  ) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

export async function listProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    include: { category: true, addons: true },
  });
}

export async function createProduct(input: ProductInput) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new ProductServiceError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
  }

  const slug = await uniqueProductSlug(category.slug, input.name);
  const maxOrder = await prisma.product.aggregate({
    where: { categoryId: input.categoryId },
    _max: { order: true },
  });

  return prisma.product.create({
    data: {
      categoryId: input.categoryId,
      name: input.name,
      slug,
      description: input.description || "",
      ingredients: input.ingredients || "",
      priceCents: input.priceCents,
      imageUrl: input.imageUrl || null,
      active: input.active,
      order: (maxOrder._max.order ?? -1) + 1,
      addons: {
        create: input.addons.map((a) => ({ name: a.name, priceCents: a.priceCents })),
      },
    },
    include: { category: true, addons: true },
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { addons: true } });
  if (!existing) {
    throw new ProductServiceError("Produto não encontrado.", "NOT_FOUND");
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new ProductServiceError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
  }

  const slug =
    input.name !== existing.name || input.categoryId !== existing.categoryId
      ? await uniqueProductSlug(category.slug, input.name, id)
      : existing.slug;

  const keepIds = new Set(input.addons.filter((a) => a.id).map((a) => a.id!));
  const removedIds = existing.addons.filter((a) => !keepIds.has(a.id)).map((a) => a.id);

  const newImageUrl = input.imageUrl || null;

  const updated = await prisma.$transaction(async (tx) => {
    if (removedIds.length > 0) {
      // FK order_item_addons.addonId é ON DELETE SET NULL — histórico de pedidos preserva o snapshot.
      await tx.productAddon.deleteMany({ where: { id: { in: removedIds } } });
    }
    for (const addon of input.addons) {
      if (addon.id) {
        await tx.productAddon.update({
          where: { id: addon.id },
          data: { name: addon.name, priceCents: addon.priceCents },
        });
      } else {
        await tx.productAddon.create({
          data: { productId: id, name: addon.name, priceCents: addon.priceCents },
        });
      }
    }
    return tx.product.update({
      where: { id },
      data: {
        categoryId: input.categoryId,
        name: input.name,
        slug,
        description: input.description || "",
        ingredients: input.ingredients || "",
        priceCents: input.priceCents,
        imageUrl: newImageUrl,
        active: input.active,
      },
      include: { category: true, addons: true },
    });
  });

  if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
    await deleteProductImageIfLocal(existing.imageUrl);
  }

  return updated;
}

/** Só permite excluir produtos nunca vendidos (FK order_items.productId é RESTRICT) — use `active` para os demais. */
export async function deleteProduct(id: string): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new ProductServiceError("Produto não encontrado.", "NOT_FOUND");
  }
  const usedInOrder = await prisma.orderItem.findFirst({ where: { productId: id } });
  if (usedInOrder) {
    throw new ProductServiceError(
      "Este produto já foi usado em pedidos e não pode ser excluído — desative-o em vez disso.",
      "IN_USE"
    );
  }
  await prisma.product.delete({ where: { id } });
  await deleteProductImageIfLocal(existing.imageUrl);
}
