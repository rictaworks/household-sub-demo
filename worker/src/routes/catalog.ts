import { Hono } from "hono";
import type { AppEnv } from "../env";
import { INTERVAL_OPTIONS, QUANTITY_MAX } from "../domain";
import { listCategories, listProducts } from "../repository";

export const catalogRoutes = new Hono<AppEnv>();

// 旧 GET / （?category=slug で絞り込み。未知の slug は全件表示）
catalogRoutes.get("/products", async (c) => {
  const categories = await listCategories(c.env.DB);
  const requested = c.req.query("category") ?? "";
  const selectedCategory = categories.some((cat) => cat.slug === requested) ? requested : null;
  const products = await listProducts(c.env.DB, selectedCategory);

  return c.json({
    categories: categories.map((cat) => ({ id: cat.id, name: cat.name, slug: cat.slug })),
    selectedCategory,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      inStock: p.inStock === 1,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      categorySlug: p.categorySlug,
    })),
    intervalOptions: [...INTERVAL_OPTIONS],
    quantityMax: QUANTITY_MAX,
  });
});
