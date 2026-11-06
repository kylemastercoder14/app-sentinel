export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", margin: "3rem", maxWidth: 640 }}>
      <h1>App Sentinel Next.js example</h1>
      <p>Call <code>/api/test-sentinel</code> to create a development-only test error.</p>
    </main>
  );
}
