import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel">
      <h2>Sidan hittades inte</h2>
      <p>Kontrollera box-id eller gå tillbaka till översikten.</p>
      <Link className="button" href="/">
        Till översikten
      </Link>
    </div>
  );
}
