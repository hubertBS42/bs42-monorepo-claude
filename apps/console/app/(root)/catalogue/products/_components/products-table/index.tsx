"use client"
import { DataTable } from "@workspace/tables"
import type { ProductsData } from "@/types"
import { columns, getProductHref } from "./columns"
import { getProductFilters } from "./filters"
import type { ProductFilterOptions } from "@/lib/data/products.data"
import BulkProductActions, { type CategoryChoices } from "./bulk-product-actions"

interface ProductsTableProps {
  data: ProductsData
  filterOptions: ProductFilterOptions
  // Where ticked products can be moved: the product form's category options
  categoryChoices: CategoryChoices
}

const ProductsTable = ({ data, filterOptions, categoryChoices }: ProductsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={getProductFilters(filterOptions)}
      data={data.data}
      getRowHref={getProductHref}
      getRowId={(product) => product.id}
      selectionActions={(products, clear) => <BulkProductActions products={products} categories={categoryChoices} clear={clear} />}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default ProductsTable
