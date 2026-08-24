import { signIn } from "@/lib/auth";
import { DevLoginButtons } from "@/components/DevLoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <svg viewBox="0 0 40 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2L23 22H5L14 2Z" stroke="#F5F7F7" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M26 10L35 28H17L26 10Z" fill="#F5F7F7" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>Arselle Relationship Ledger</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
          Sign in with your Arselle Microsoft 365 account.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: callbackUrl || "/contacts" });
          }}
        >
          <button className="btn primary" type="submit" style={{ width: "100%" }}>
            Sign in with Microsoft
          </button>
        </form>
        {process.env.NODE_ENV !== "production" && (
          <DevLoginButtons callbackUrl={callbackUrl || "/contacts"} />
        )}
      </div>
    </div>
  );
}
