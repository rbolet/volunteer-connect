import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Volunteer Connect",
  description: "Volunteer signup and team points management",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
