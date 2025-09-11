export const metadata = { title: 'Jelli OAuth Next.js', description: 'Minimal PKCE client for jelli-oauth-backend' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        margin: 0,
        padding: 24,
      }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Jelli OAuth Next.js</h1>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Minimal PKCE client for jelli-oauth-backend</div>
        </header>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}

