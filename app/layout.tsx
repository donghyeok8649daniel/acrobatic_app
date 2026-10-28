import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAIST 아크로바틱",
  description: "카이스트 족구동아리 아크로바틱의 일정, 출석, 선수, 회비와 경기 기록을 함께 관리하는 팀 공간.",
  manifest: "/manifest.webmanifest",
  applicationName: "아크로바틱",
  appleWebApp: { capable: true, title: "아크로바틱", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-180.png",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#152a2e", viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
