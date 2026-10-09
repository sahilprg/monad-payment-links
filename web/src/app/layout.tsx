import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const sans = Bricolage_Grotesque({
  variable: "--font-sans-face",
  subsets: ["latin"],
});

// Used only for the personal note, so it reads as handwriting on a letter.
const hand = Caveat({
  variable: "--font-hand-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paperplane",
  description: "Money from home, sent like a message.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${hand.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
