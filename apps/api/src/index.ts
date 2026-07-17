import { createPrismaClient } from "@vc/db"
import { logger } from "@vc/logger"
import { createApp } from "./app"
import { createRepos } from "./repositories"

const prisma = createPrismaClient()
const app = createApp(createRepos(prisma))

const PORT = process.env.PORT ?? 4000

app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`)
})
