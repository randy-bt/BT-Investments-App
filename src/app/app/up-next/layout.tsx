/**
 * Tag the document body with a data attribute while a user is on
 * /app/up-next so any chrome that snuck through the React-level
 * hide can be CSS-hidden as a final safety net.
 *
 * Renders no extra DOM — just the children — so the parent /app
 * layout (AuthProvider, AppToolbar, AppNavbar) still wraps everything.
 */
export default function UpNextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        body:has(.up-next-page) [data-app-toolbar],
        body:has(.up-next-page) [data-app-navbar] { display: none !important; }
        /* Slightly lighter page background on Up Next so the dark
           card's drop shadow has more room to read. */
        body:has(.up-next-page) { background: #fafafa !important; }
        .dark body:has(.up-next-page) { background: #232323 !important; }
      `}</style>
      <div className="up-next-page">{children}</div>
    </>
  );
}
