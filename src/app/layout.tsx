import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getSessionFromCookies } from "@/lib/session";
import HeaderNav from "@/app/HeaderNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PPI Curug Simulator Training",
  description: "PPI Curug Simulator Training — Simulator Booking & Management System",
  icons: {
    icon: "/PPIC-removebg-preview.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionFromCookies();

  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="relative min-h-dvh w-full overflow-x-hidden bg-white text-zinc-900">
          {/* Foreground app UI layer */}
          <div className="relative z-10">
            <div className="border-b border-white/15 bg-[#05164d] text-white shadow-sm" data-print-hidden="true">
              <div className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 font-bold tracking-tight">
                  <img
                    src="/logoppic/logoppic.7a5aa04c.png"
                    alt="Politeknik Penerbangan Indonesia Curug"
                    width={56}
                    height={40}
                    className="h-10 w-auto"
                  />
                  <span className="min-w-0 truncate">
                    <span className="sm:hidden">PPI Curug</span>
                    <span className="hidden sm:inline">PPI Curug Simulator Training</span>
                  </span>
                </Link>
                <div className="shrink-0">
                  <HeaderNav session={session ? { username: session.username, role: session.role } : null} />
                </div>
              </div>
            </div>

            <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">{children}</main>

            <footer className="border-t border-zinc-200 bg-white" data-print-hidden="true">
              <div className="mx-auto max-w-6xl px-4 py-8">
              <div className="grid gap-8 md:grid-cols-12 md:items-start">
              <div className="grid gap-2 md:col-span-4">
                <div className="text-sm font-semibold">Contact Us</div>
                <div className="text-sm text-zinc-600">
                  Email: <a className="underline" href="mailto:dpu@ppicurug.ac.id">dpu@ppicurug.ac.id</a>
                </div>
                <div className="text-sm text-zinc-600">
                  Phone: <a className="underline" href="tel:+6287778229661">+62 877-7822-9661</a>
                </div>
              </div>

              <div className="grid gap-2 md:col-span-8">
                <div className="text-sm font-semibold">Links</div>
                <a
                  className="text-sm text-zinc-600 underline"
                  href="https://ppicurug.ac.id/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ppicurug.ac.id
                </a>
                <div className="pt-3 text-sm font-semibold">Follow Us</div>
                <a
                  className="text-sm text-zinc-600 underline"
                  href="https://www.instagram.com/ppicurug.official/"
                  target="_blank"
                  rel="noreferrer"
                >
                  @ppicurug.official
                </a>
              </div>
            </div>

            <div className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
              © {new Date().getFullYear()} PPI Curug Simulator Training
            </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
