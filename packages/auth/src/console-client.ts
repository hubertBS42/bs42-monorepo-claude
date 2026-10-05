"use client"

import {
  adminClient,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { systemAccessController, systemRoles } from "./system-permissions"
import {
  organizationAccessController,
  organizationRoles,
} from "./organization-permissions"
import type { consoleAuth } from "./console"

export const consoleAuthClient = createAuthClient({
  plugins: [
    adminClient({
      ac: systemAccessController,
      roles: systemRoles,
    }),
    organizationClient({
      ac: organizationAccessController,
      roles: organizationRoles,
      schema: inferOrgAdditionalFields<typeof consoleAuth>(),
    }),
  ],
})
