export interface ProductAddonView {
  id: string;
  name: string;
  priceCents: number;
}

export interface ProductView {
  id: string;
  name: string;
  slug: string;
  description: string;
  ingredients: string;
  priceCents: number;
  imageUrl: string | null;
  addons: ProductAddonView[];
}

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  products: ProductView[];
}
