// app/admin/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AdminUploadForm from '@/components/AdminUploadForm'; // Assuming AdminUploadForm.tsx is in src/components/

export default async function AdminPage() {
  const { userId } = await auth(); // Gets session information.
                           // Middleware should have already redirected if not authenticated.

  // Explicit check for userId, though middleware should cover unauthenticated access.
  if (!userId) {
    // This might be redundant if middleware correctly redirects to sign-in for /admin
    // but serves as a fallback.
    return redirect('/sign-in?redirect_url=' + encodeURIComponent('/admin'));
  }

  const user = await currentUser(); // Fetches the full user object for metadata

  // Check for admin role using publicMetadata
  // Ensure you have set `publicMetadata: { "role": "admin" }` for your admin users
  // in your Clerk dashboard (Users -> select user -> Metadata -> Public metadata).
  const isAdmin = user?.publicMetadata?.role === 'admin';

  if (!isAdmin) {
    // If the user is logged in but not an admin, redirect them to the homepage.
    console.log(`User ${userId} (${user?.emailAddresses[0]?.emailAddress}) attempted to access admin page without admin role. Metadata:`, user?.publicMetadata);
    return redirect('/'); // Or a specific "access denied" page
  }

  // If the user is an authenticated admin, render the actual form component.
  return (
    <div style={{ minHeight: '80vh', background: '#06060f' }}>
      <AdminUploadForm />
    </div>
  );
}
