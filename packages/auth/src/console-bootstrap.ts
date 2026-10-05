import "server-only"

import { betterAuth } from "better-auth"
import { admin, organization } from "better-auth/plugins"
import { authURLs, sharedAuthOptions } from "./shared"

export const consoleBootstrapAuth = betterAuth({
  ...sharedAuthOptions,
  appName: "BS42 Console Setup",
  baseURL: authURLs.console,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: (user) => user.role === "superAdmin",
    }),
  ],
})
