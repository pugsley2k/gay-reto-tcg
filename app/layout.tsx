// app/layout.tsx
import "./globals.css";
import { Honk } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import { CartProvider } from '@/components/CartProvider';

const honk = Honk({
  subsets: ["latin"],
  variable: "--font-honk",
  display: "swap",
  axes: ["MORF", "SHLN"],
});

export const metadata = {
  title: "GAY RETRO TCG",
  description: "Rare Pokémon cards. Loud colours. Zero apologies.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "GAY RETRO TCG",
    description: "Rare Pokémon cards. Loud colours. Zero apologies.",
    url: "https://gay-reto-tcg.vercel.app",
    siteName: "GAY RETRO TCG",
    images: [{ url: "/logo.png", width: 930, height: 930, alt: "GAY RETRO TCG" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GAY RETRO TCG",
    description: "Rare Pokémon cards. Loud colours. Zero apologies.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={honk.variable}>
      <body>
        <ClerkProvider>
          <CartProvider>
            <Navbar />
            <main>{children}</main>
          </CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
