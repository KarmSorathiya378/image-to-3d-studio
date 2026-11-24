import type { Metadata } from "next";
import { Providers } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Image-to-3D Studio",
  description:
    "Single-photo procedural 3D reconstruction with Universal BYOK AI models and deterministic Blender geometry engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
