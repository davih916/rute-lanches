import { listCategoriesForAdmin } from "@/lib/services/category-service";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function AdminCategoriasPage() {
  const categories = await listCategoriesForAdmin();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-bold text-neutral-900">Categorias</h1>
      <CategoryManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          active: category.active,
          productCount: category._count.products,
        }))}
      />
    </div>
  );
}
