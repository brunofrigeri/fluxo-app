/** Shown instantly on every navigation inside the app shell while the server component streams in. */
export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="skel" style={{ height: 34, width: 220 }} />
      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skel" style={{ height: 20, width: "40%" }} />
        <div className="skel" style={{ height: 44 }} />
        <div className="skel" style={{ height: 44 }} />
        <div className="skel" style={{ height: 44, width: "70%" }} />
      </div>
    </div>
  );
}
