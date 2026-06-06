import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card p-4">
        <h2 className="mb-6 text-lg font-bold text-foreground">AlphaCarnes</h2>
        <nav className="space-y-1">
          <a href="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Dashboard
          </a>
        </nav>
      </aside>
      {/* Main */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
