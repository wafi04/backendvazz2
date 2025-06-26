import { Hono } from "hono";
import { News } from "../services/news/service";
import { newsCreateSchema, newsSchema, newsUpdateSchema } from "../validation/news";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { NewsData } from "../types/news";

const hono = new Hono();
const newsService = new News();

// Validation schemas
const idParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10))
});

// Query params untuk pagination dan filter (opsional)
const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional()
});

// GET /news - Get all news with optional pagination and search
hono.get('/', zValidator('query', querySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const news = await newsService.getNews() as NewsData[]
    
    // Optional: Implement pagination and search logic here
    let filteredNews = news;
    
    if (query.search) {
      filteredNews = news.filter((item: NewsData) => 
        item.type.toLowerCase().includes(query.search!.toLowerCase())
      );
    }

    if(query.status) {
      filteredNews = news.filter((item: NewsData) => item.isActive === query.status);
    }
    

    return c.json({
      success: true,
      message: "News retrieved successfully",
      data: filteredNews
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return c.json({
      success: false,
      message: "Failed to retrieve news",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// GET /news/:id - Get news by ID
hono.get('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param');
    const news = await newsService.getAllNewsById(id);
    
    if (!news) {
      return c.json({
        success: false,
        message: "News not found"
      }, 404);
    }

    return c.json({
      success: true,
      message: "News retrieved successfully",
      data: news
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return c.json({
      success: false,
      message: "Failed to retrieve news",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// POST /news - Create new news
hono.post('/', zValidator('json', newsSchema), async (c) => {
  try {
    const newsData = c.req.valid('json');
    const newNews = await newsService.create(newsData);
    
    return c.json({
      success: true,
      message: "News created successfully",
      data: newNews
    }, 201);
  } catch (error) {
    console.error('Error creating news:', error);
    return c.json({
      success: false,
      message: "Failed to create news",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// PUT /news/:id - Update news (full update)
hono.put('/:id', 
  zValidator('param', idParamSchema),
  zValidator('json', newsSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param');
      const updateData = c.req.valid('json');
      
      const updatedNews = await newsService.update(id, updateData);
      
      return c.json({
        success: true,
        message: "News updated successfully",
        data: updatedNews
      });
    } catch (error) {
      console.error('Error updating news:', error);
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return c.json({
          success: false,
          message: "News not found"
        }, 404);
      }
      return c.json({
        success: false,
        message: "Failed to update news",
        error: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }
);

// PATCH /news/:id - Partial update news
hono.patch('/:id',
  zValidator('param', idParamSchema),
  zValidator('json', newsSchema.partial()),
  async (c) => {
    try {
      const { id } = c.req.valid('param');
      const updateData = c.req.valid('json');
      
      const updatedNews = await newsService.update(id, updateData as newsUpdateSchema);
      
      return c.json({
        success: true,
        message: "News updated successfully",
        data: updatedNews
      });
    } catch (error) {
      console.error('Error updating news:', error);
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return c.json({
          success: false,
          message: "News not found"
        }, 404);
      }
      return c.json({
        success: false,
        message: "Failed to update news",
        error: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }
);

// DELETE /news/:id - Delete news
hono.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param');
    
    // Check if news exists first
    const existingNews = await newsService.getAllNewsById(id);
    if (!existingNews) {
      return c.json({
        success: false,
        message: "News not found"
      }, 404);
    }

    const deletedNews = await newsService.delete(id);
    
    return c.json({
      success: true,
      message: "News deleted successfully",
      data: deletedNews
    });
  } catch (error) {
    console.error('Error deleting news:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return c.json({
        success: false,
        message: "News not found"
      }, 404);
    }
    return c.json({
      success: false,
      message: "Failed to delete news",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default hono;