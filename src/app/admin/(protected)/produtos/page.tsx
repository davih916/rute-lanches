import { prisma } from "@/lib/prisma";
import { listProductsForAdmin } from "@/lib/services/product-service";
import { ProductManager } from "@/components/admin/product-manager";
import { ProductFiscalTable } from "@/components/admin/product-fiscal-table";

export default async function AdminProdutosPage() {
  const [products, categories] = await Promise.all([
    listProductsForAdmin(),
    prisma.category.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-neutral-900">Produtos</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Cadastre e edite nome, preço, foto, ingredientes e adicionais de cada produto.
      </p>

      <ProductManager
        products={products.map((product) => ({
          id: product.id,
          categoryId: product.categoryId,
          categoryName: product.category.name,
          name: product.name,
          description: product.description,
          ingredients: product.ingredients,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
          active: product.active,
          addons: product.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            priceCents: addon.priceCents,
          })),
        }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />

      <h2 className="mb-3 mt-10 text-base font-bold text-neutral-900">Dados fiscais</h2>
      <p className="mb-4 text-sm text-neutral-500">
        NCM, CFOP, CSOSN/CST e unidade comercial — obrigatórios para emitir NFC-e.
      </p>
      <ProductFiscalTable
        products={products
          .filter((product) => product.active)
          .map((product) => ({
            id: product.id,
            name: product.name,
            categoryName: product.category.name,
            ncm: product.ncm,
            cfop: product.cfop,
            csosnCst: product.csosnCst,
            unidadeComercial: product.unidadeComercial,
          }))}
      />
    </div>
  );
}
