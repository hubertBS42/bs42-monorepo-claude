# @workspace/storage

Server-side Azure Blob Storage helpers for uploading, deleting, and restoring
files. Do not import this package into client components.

## Configuration

Set `AZURE_STORAGE_ACCOUNT_NAME` to the storage account name. The package uses
`DefaultAzureCredential`, so configure an Azure identity supported by the Azure
Identity SDK and grant it the **Storage Blob Data Contributor** role on the
target storage account or container.

`AZURE_STORAGE_CONTAINER_NAME` is optional and defaults to `bs42`.

The package returns stable HTTPS blob URLs. To make those URLs readable by
browsers without SAS tokens, allow blob public access on the storage account
and set the container's public access level to **Blob**. This makes blob data
publicly readable; upload, delete, and restore operations still require the
server's Azure identity. The package does not change account or container access
policies automatically.

## API behavior

The console API applies upload size, count, and content-type limits before
calling this package. The storage package stays focused on Azure blob
operations.

## URL handling

`deleteFiles` and `restoreFiles` accept blob URLs only when they use the
configured account and container. URLs from other hosts, containers, or with
query strings are rejected.

`restoreFiles` uses Azure Blob undelete; enable blob soft delete on the storage
account for undo workflows to work.
