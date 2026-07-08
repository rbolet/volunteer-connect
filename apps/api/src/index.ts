import express from "express"

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(express.json())

// Routes will be registered here

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})

export { app }
