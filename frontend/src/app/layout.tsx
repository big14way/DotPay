"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/config/wagmi";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/Navbar";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <title>DotPay — Blockchain Payments for Africa</title>
      </head>
      <body className="font-sans antialiased min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: "#E6007A",
                accentColorForeground: "white",
                borderRadius: "medium",
                overlayBlur: "small",
              })}
            >
              <Navbar />
              <main className="pt-16">{children}</main>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "#13131A",
                    color: "#FAFAFA",
                    border: "1px solid #1E1E2E",
                  },
                }}
              />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
