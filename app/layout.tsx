// app/layout.tsx
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import { CartProvider } from '@/components/CartProvider';


export const metadata = {
  metadataBase: new URL('https://gay-reto-tcg.vercel.app'),
  title: "GAY RETRO TCG",
  description: "Rare Pokémon cards. Loud colours. Zero apologies.",
  manifest: '/site.webmanifest',
  appleWebApp: { capable: true, title: 'Gay Retro' },
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
    <html lang="en">
      <body>
        <ClerkProvider>
          <CartProvider>
            <Navbar />
            <a href="#main-content" className="skip-link">Skip to content</a>
            {children}
          </CartProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
