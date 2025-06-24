// interfaces/pagination.interface.ts
export interface PaginationParams {
  limit?: string
  page?: string
}

export interface FilterCategories extends PaginationParams {
  search?: string
  status?: string
}

export interface PaginationMeta {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// utils/pagination.util.ts
export class PaginationUtil {
  static calculatePagination(page?: string, limit?: string) {
    const currentPage = Math.max(1, parseInt(page || '1', 10))
    const itemsPerPage = Math.min(100, Math.max(1, parseInt(limit || '10', 10)))
    const skip = (currentPage - 1) * itemsPerPage

    return {
      skip,
      take: itemsPerPage,
      currentPage,
      itemsPerPage
    }
  }

  static createPaginationMeta(
    currentPage: number,
    itemsPerPage: number,
    totalItems: number
  ): PaginationMeta {
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    
    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    }
  }

  static createPaginatedResponse<T>(
    data: T[],
    currentPage: number,
    itemsPerPage: number,
    totalItems: number
  ): PaginatedResponse<T> {
    return {
      data,
      meta: this.createPaginationMeta(currentPage, itemsPerPage, totalItems)
    }
  }
}