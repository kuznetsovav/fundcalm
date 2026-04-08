import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "FundCalm",
  description: "Simple fund management, done right.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <div
          className={[
            "mx-auto min-h-dvh w-full min-w-0",
            "max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl",
            "px-4 sm:px-6 md:px-8 lg:px-10",
            "pt-8 sm:pt-10 md:pt-12 lg:pt-14",
            "pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-10 md:pb-12 lg:pb-14",
          ].join(" ")}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
