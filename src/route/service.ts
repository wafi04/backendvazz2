import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { authMiddleware } from "../middleware/auth";
import { createErrorResponse } from "../utils/response";
import { ProductService } from "../services/service/product";
import { ServiceSchema } from "../validation/service";
import { AuthService } from "../services/users/auth";
import { success } from "zod/v4";

const productRoutes = new Hono();
const productService = new ProductService();
const authService = new AuthService()

// GET /api/products - Get all products
productRoutes.get("/", async (c) => {
  try {
    const products = await productService.getProducts();
    
    return c.json({
      success: true,
      data: products,
      count: products.length ?? 0
    });
  } catch (error) {
    console.error("Get products error:", error);
    throw new HTTPException(500, { message: "Failed to fetch products" });
  }
});


productRoutes.get("/category/:categoryId/:subCategoryId?", async (c) => {
  try {
    // Ambil dari params, bukan query
    const categoryId = c.req.param("categoryId");
    const subCategoryId = c.req.param("subCategoryId");
    
    if (!categoryId) {
      throw new HTTPException(400, { message: "Category ID is required" });
    }
    
    let userRole = 'member'; // default role untuk user yang belum login
    
    try {
      const user = c.get("jwtPayload") as { role: string };
      if (user && user.role) {
        userRole = user.role;
      }
    } catch (error) {
      // User tidak login atau token invalid, gunakan default role
      userRole = 'member';
    }
    
    const services = await productService.getServiceByCategory(
      categoryId,
      subCategoryId,
      userRole
    );
    
    return c.json({
      success: true,
      data: services,
      message: "Products fetched successfully"
    });

  } catch (error) {
    console.error("Get products by category error:", error);
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: "Failed to fetch products by category" });
  }
});

// GET /api/products/code/:code - Get product by provider code
productRoutes.get("/code/:code", async (c) => {
  try {
    const code = c.req.param("code");
    
    if (!code) {
      throw new HTTPException(400, { message: "Provider code is required" });
    }
    
    const product = await productService.getProductByCode(code);
    
    if (!product) {
      throw new HTTPException(404, { message: "Product not found" });
    }
    
    return c.json({
      success: true,
      data: product
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    
    console.error("Get product by code error:", error);
    throw new HTTPException(500, { message: "Failed to fetch product" });
  }
});

// POST /api/products - Create new product (Admin only)
productRoutes.post(
  "/",
  authMiddleware,
  validator("json", (value, c) => {
    const parsed = ServiceSchema.safeParse(value);
    if (!parsed.success) {
      return createErrorResponse("Invalid input", 400, parsed.error.errors);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const user = c.get("jwtPayload") as { userId: number, role: string };
      
      // Check if user is admin
      if (user.role !== "admin") {
        throw new HTTPException(403, { message: "Insufficient permissions" });
      }
      
      const input = c.req.valid("json");
      
      // Note: You'll need to implement createProduct method in ProductService
      // const product = await productService.createProduct(input);
      
      return c.json({
        success: true,
        message: "Product created successfully",
        // data: product
      }, 201);
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      
      console.error("Create product error:", error);
      throw new HTTPException(500, { message: "Failed to create product" });
    }
  }
);

// PUT /api/products/:id - Update product (Admin only)
productRoutes.put(
  "/:id",
  authMiddleware,
  validator("json", (value, c) => {
    const parsed = ServiceSchema.safeParse(value);
    if (!parsed.success) {
      return createErrorResponse("Invalid input", 400, parsed.error.errors);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const user = c.get("jwtPayload") as { userId: number, role: string };
      
      // Check if user is admin
      if (user.role !== "admin") {
        throw new HTTPException(403, { message: "Insufficient permissions" });
      }
      
      const id = parseInt(c.req.param("id"));
      
      if (isNaN(id)) {
        throw new HTTPException(400, { message: "Invalid product ID" });
      }
      
      const input = c.req.valid("json");
      
      // Check if product exists
      const existingProduct = await productService.getProductById(id);
      if (!existingProduct) {
        throw new HTTPException(404, { message: "Product not found" });
      }
      
      const updatedProduct = await productService.updateProduct(id, input);
      
      return c.json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      
      console.error("Update product error:", error);
      throw new HTTPException(500, { message: "Failed to update product" });
    }
  }
);

// DELETE /api/products/:id - Delete product (Admin only)
productRoutes.delete("/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { userId: number, role: string };
    
    // Check if user is admin
    if (user.role !== "admin") {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }
    
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { message: "Invalid product ID" });
    }
    
    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      throw new HTTPException(404, { message: "Product not found" });
    }
    
    await productService.deleteProduct(id);
    
    return c.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    
    console.error("Delete product error:", error);
    throw new HTTPException(500, { message: "Failed to delete product" });
  }
});

// GET /api/products/search - Search products
productRoutes.get("/search", async (c) => {
  try {
    const query = c.req.query("q");
    const category = c.req.query("category");
    const minPrice = c.req.query("minPrice");
    const maxPrice = c.req.query("maxPrice");
    
    // You'll need to implement search method in ProductService
    // const products = await productService.searchProducts({
    //   query,
    //   category,
    //   minPrice: minPrice ? parseFloat(minPrice) : undefined,
    //   maxPrice: maxPrice ? parseFloat(maxPrice) : undefined
    // });
    
    return c.json({
      success: true,
      // data: products,
      // count: products.length
      message: "Search functionality not implemented yet"
    });
  } catch (error) {
    console.error("Search products error:", error);
    throw new HTTPException(500, { message: "Failed to search products" });
  }
});

export default productRoutes;