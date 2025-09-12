export const metadata = { title: 'Jelli OAuth Next.js', description: 'Minimal PKCE client for jelli-oauth-backend' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </head>
      <body style={{
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        margin: 0,
        padding: 0,
      }}>
        {children}
      </body>
    </html>
  );
}

