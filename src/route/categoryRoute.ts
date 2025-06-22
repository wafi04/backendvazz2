import { Hono } from "hono";
import { validator } from "hono/validator";
import { HTTPException } from "hono/http-exception";
import { FormCategory, FormValuesCategory } from "../validation/category"; // sesuaikan path
import { CategoryService } from "../services/categories/service";

const category = new Hono();
const categoryService = new CategoryService();

// GET /categories - Get all categories
category.get("/", async (c) => {
  try {
    const categories = await categoryService.getAllCategories();
    return c.json({
      success: true,
      data: categories,
      message: "Categories retrieved successfully"
    });
  } catch (error) {
    console.error("Get all categories error:", error);
    throw new HTTPException(500, { 
      message: "Failed to retrieve categories" 
    });
  }
});

// GET /categories/:id - Get category by ID
category.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { 
        message: "Invalid category ID" 
      });
    }

    const categoryData = await categoryService.getCategoryById(id);
    
    if (!categoryData) {
      throw new HTTPException(404, { 
        message: "Category not found" 
      });
    }

    return c.json({
      success: true,
      data: categoryData,
      message: "Category retrieved successfully"
    });
  } catch (error) {
    console.error("Get category by ID error:", error);
    
    if (error instanceof HTTPException) {
      throw error;
    }
    
    throw new HTTPException(500, { 
      message: "Failed to retrieve category" 
    });
  }
});

// POST /categories - Create new category
category.post(
  "/",
  validator("json", (value, c) => {
    if (!value || typeof value !== "object") {
      return c.json(
        {
          success: false,
          error: "Invalid input format",
        },
        400
      );
    }
        const parsed = FormCategory.safeParse(value);
    return parsed.success
      ? parsed.data
      : c.json(
          {
            success: false,
            error: "Invalid input",
            details: parsed.error.errors,
          },
          400
        );
  }),
  async (c) => {
    try {
      const data = c.req.valid("json") 
      
      const newCategory = await categoryService.createCategory(data);
      
      return c.json({
        success: true,
        data: newCategory,
        message: "Category created successfully"
      }, 201);
    } catch (error) {
      console.error("Create category error:", error);
      
      // Handle Prisma unique constraint errors
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new HTTPException(409, { 
          message: "Category with this name already exists" 
        });
      }
      
      throw new HTTPException(500, { 
        message: "Failed to create category" 
      });
    }
  }
);

// PUT /categories/:id - Update category
category.put(
  "/:id",
  validator("json", (value, c) => {
    if (!value || typeof value !== "object") {
      return c.json(
        {
          success: false,
          error: "Invalid input format",
        },
        400
      );
    }

    const parsed = FormCategory.safeParse(value);
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: "Invalid input",
          details: parsed.error.errors,
        },
        400
      );
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      
      if (isNaN(id)) {
        throw new HTTPException(400, { 
          message: "Invalid category ID" 
        });
      }

      const data = c.req.valid("json") 
      
      const updatedCategory = await categoryService.updateCategory(data, id);
      
      return c.json({
        success: true,
        data: updatedCategory,
        message: "Category updated successfully"
      });
    } catch (error) {
      console.error("Update category error:", error);
      
      // Handle Prisma record not found
      if (error instanceof Error && error.message.includes("Record to update not found")) {
        throw new HTTPException(404, { 
          message: "Category not found" 
        });
      }
      
      // Handle unique constraint
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new HTTPException(409, { 
          message: "Category with this name already exists" 
        });
      }
      
      throw new HTTPException(500, { 
        message: "Failed to update category" 
      });
    }
  }
);

// DELETE /categories/:id - Delete category
category.delete("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { 
        message: "Invalid category ID" 
      });
    }

    const deletedCategory = await categoryService.deleteCategory(id);
    
    return c.json({
      success: true,
      data: deletedCategory,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete category error:", error);
    
    // Handle Prisma record not found
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      throw new HTTPException(404, { 
        message: "Category not found" 
      });
    }
    
    // Handle foreign key constraint (jika category digunakan di tabel lain)
    if (error instanceof Error && error.message.includes("Foreign key constraint")) {
      throw new HTTPException(409, { 
        message: "Cannot delete category that is being used" 
      });
    }
    
    throw new HTTPException(500, { 
      message: "Failed to delete category" 
    });
  }
});

// // GET /categories/clear-cache - Clear cache (untuk testing/maintenance)
// category.post("/clear-cache", async (c) => {
//   try {
//     await categoryService.clearCache();
    
//     return c.json({
//       success: true,
//       message: "Category cache cleared successfully"
//     });
//   } catch (error) {
//     console.error("Clear cache error:", error);
//     throw new HTTPException(500, { 
//       message: "Failed to clear cache" 
//     });
//   }
// });

export default category;