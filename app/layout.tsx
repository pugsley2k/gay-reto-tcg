// app/layout.tsx
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import { CartProvider } from '@/components/CartProvider';


export const metadata = {
  metadataBase: new URL('https://www.gayretrotcg.com'),
  title: "GAY RETRO TCG",
  description: "Browse Pokémon singles in English, Japanese and Korean at Gay Retro TCG.",
  manifest: '/site.webmanifest',
  appleWebApp: { capable: true, title: 'Gay Retro' },
  icons: {
    icon: "/brand-mark.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "GAY RETRO TCG",
    description: "Browse Pokémon singles in English, Japanese and Korean at Gay Retro TCG.",
    url: "https://www.gayretrotcg.com",
    siteName: "GAY RETRO TCG",
    images: [{ url: "/brand-share.png", width: 1200, height: 630, alt: "GAY RETRO TCG" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GAY RETRO TCG",
    description: "Browse Pokémon singles in English, Japanese and Korean at Gay Retro TCG.",
    images: ["/brand-share.png"],
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
