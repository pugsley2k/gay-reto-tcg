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
  description: "Your one-stop shop for Gay Retro Trading Cards!",
  icons: {
    icon: "/favicon.png",
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
