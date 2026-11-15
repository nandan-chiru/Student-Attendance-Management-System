import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Attendance Management System",
  description: "A DBMS Level 3 project foundation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
