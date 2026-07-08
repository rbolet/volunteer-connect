import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use process.env directly so prisma generate works without DATABASE_URL
    // (e.g. in CI type-check steps). Use env("DATABASE_URL") if you want
    // strict enforcement at CLI load time.
    url: process.env.DATABASE_URL ?? "",
  },
})
