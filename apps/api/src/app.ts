import express, { type Application } from "express"

const app: Application = express()

app.use(express.json())

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Routes will be registered here

export { app }
