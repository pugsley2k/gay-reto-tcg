// app/shop/layout.tsx
import React from 'react';



// You can define metadata specific to the shop section here if needed
// export const metadata = {
//   title: 'Shop - GAY RETRO TCG',
//   description: 'Browse our collection of retro trading cards.',
// };

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", margin: "0", padding: "0" }}>
      {children}
    </div>
  );
}

