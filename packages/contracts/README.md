# @workspace/contracts

Shared data contracts used across workspace packages and applications. Keep
only types that are consumed by more than one package or app here.

`DocumentItem` describes an uploaded document by its display name and storage
URL. The storage API and forms package both use this contract.
