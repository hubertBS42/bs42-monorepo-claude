// The built templates import workspace packages (such as @workspace/contracts) that ship
// raw TypeScript with extensionless relative imports. Next's bundler resolves those, plain
// Node does not, so for tests we retry a failed relative import from a .ts file with
// TypeScript extensions. Node strips the types itself.
import { registerHooks } from "node:module"

const candidateSuffixes = [".ts", ".tsx", "/index.ts", "/index.tsx"]

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      const isRelative = specifier.startsWith("./") || specifier.startsWith("../")
      const fromTypeScript = /\.tsx?$/.test(context.parentURL ?? "")
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || !isRelative || !fromTypeScript) throw error

      for (const suffix of candidateSuffixes) {
        try {
          return nextResolve(`${specifier}${suffix}`, context)
        } catch {
          // try the next suffix
        }
      }
      throw error
    }
  },
})
