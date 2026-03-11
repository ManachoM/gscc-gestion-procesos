export default function Unauthorized() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>403 — Access Denied</h1>
      <p>You don't have permission to view this page.</p>
      <a href="/">← Back to Dashboard</a>
    </main>
  );
}
