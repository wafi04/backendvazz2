import { PaginationParams } from "../utils/pagination";

export type SubCategory = {
  id: number;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  code: string;
  categoryId: number;
  isActive: string;
};


export type FilterSubCategories = PaginationParams &{
  status?: string
  search? : string
}