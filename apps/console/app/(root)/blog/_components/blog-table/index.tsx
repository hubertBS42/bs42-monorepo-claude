"use client"
import { Newspaper } from "lucide-react"
import { DataTable } from "@workspace/tables"
import type { BlogPostsData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

const BlogTable = ({ data }: { data: BlogPostsData }) => {
  return (
    <DataTable
      empty={{ icon: Newspaper, title: "No posts yet", description: "Posts you write show here." }}
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={(post) => `/blog/${post.id}/edit`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default BlogTable
