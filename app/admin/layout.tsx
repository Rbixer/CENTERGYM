export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-app-shell h-full min-h-0 w-full min-w-0 max-w-full overflow-x-clip">
      {children}
    </div>
  );
}
