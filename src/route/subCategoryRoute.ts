import { Hono } from "hono";
import { validator } from "hono/validator";
import { HTTPException } from "hono/http-exception";
import { SubCategoryService } from "../services/subCategories/service";
import { FormSubCategory } from "../validation/category";

const subCategory = new Hono();
const subCategoryService = new SubCategoryService();

subCategory.get("/", async (c) => {
  try {
    const categories = await subCategoryService.getAllSubCategories();
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

subCategory.get("/:id/ids", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { 
        message: "Invalid subCategory ID" 
      });
    }

    const categoryData = await subCategoryService.getSubCategoryById(id);
    
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
    console.error("Get subCategory by ID error:", error);
    
    if (error instanceof HTTPException) {
      throw error;
    }
    
    throw new HTTPException(500, { 
      message: "Failed to retrieve subCategory" 
    });
  }
});

subCategory.get("/pagination", async (c) => {
  try {

    const {limit,page,status,search}   = c.req.query()
    const subCategories = await subCategoryService.getSubCategoriesWithPagination({
      limit,
      page,
      status,
      search
    })
    return c.json({
      success: true,
      data: subCategories,
      message: "Sub Categories retrieved successfully"
    });
  } catch (error) {
    console.error("Get all subCategories error:", error);
    throw new HTTPException(500, { 
      message: "Failed to retrieve categories" 
    });
  }
})

subCategory.post(
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
        const parsed = FormSubCategory.safeParse(value);
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
      
      const newCategory = await subCategoryService.createSubCategory(data);
      
      return c.json({
        success: true,
        data: newCategory,
        message: "Category created successfully"
      }, 201);
    } catch (error) {
      console.error("Create subCategory error:", error);
      
      // Handle Prisma unique constraint errors
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        throw new HTTPException(409, { 
          message: "Category with this name already exists" 
        });
      }
      
      throw new HTTPException(500, { 
        message: "Failed to create subCategory" 
      });
    }
  }
);

subCategory.put(
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

    const parsed = FormSubCategory.safeParse(value);
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
          message: "Invalid subCategory ID" 
        });
      }

      const data = c.req.valid("json") 
      
      const updatedCategory = await subCategoryService.updateSubCategory(id,data);
      
      return c.json({
        success: true,
        data: updatedCategory,
        message: "Category updated successfully"
      });
    } catch (error) {
      console.error("Update subCategory error:", error);
      
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
        message: "Failed to update subCategory" 
      });
    }
  }
);

subCategory.delete("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { 
        message: "Invalid subCategory ID" 
      });
    }

    const deletedCategory = await subCategoryService.deleteSubCategory(id);
    
    return c.json({
      success: true,
      data: deletedCategory,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete subCategory error:", error);
    
    // Handle Prisma record not found
    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      throw new HTTPException(404, { 
        message: "Category not found" 
      });
    }
    
    // Handle foreign key constraint (jika subCategory digunakan di tabel lain)
    if (error instanceof Error && error.message.includes("Foreign key constraint")) {
      throw new HTTPException(409, { 
        message: "Cannot delete subCategory that is being used" 
      });
    }
    
    throw new HTTPException(500, { 
      message: "Failed to delete subCategory" 
    });
  }
});

// // // GET /categories/clear-cache - Clear cache (untuk testing/maintenance)
// subCategory.post("/clear-cache", async (c) => {
//   try {
//     await subCategoryService.clearCache();
    
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

export default subCategory;