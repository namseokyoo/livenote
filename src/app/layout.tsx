import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LiveNote - 실시간 공유 노트",
  description: "실시간으로 공유하고 협업하는 심플한 노트 앱",
  keywords: ["노트", "실시간", "공유", "협업", "메모"],
  authors: [{ name: "SidequestLab" }],
  openGraph: {
    title: "LiveNote - 실시간 공유 노트",
    description: "실시간으로 공유하고 협업하는 심플한 노트 앱",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
