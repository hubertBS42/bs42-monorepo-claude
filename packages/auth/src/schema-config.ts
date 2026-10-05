import { betterAuth } from "better-auth"
import { consolePlugins } from "./console-plugins"

export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  plugins: [...consolePlugins],
})

export default auth
