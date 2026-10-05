# `@workspace/utils`

Small, dependency-free helpers shared across workspace packages. Keep helpers
focused and export them through explicit subpaths, such as
`@workspace/utils/env`, rather than growing a package-specific catch-all.

`parsePositiveIntegerEnv(value, name, defaultValue)` parses optional environment
variable values as positive safe integers and uses the provided default when
the value is missing or blank.
