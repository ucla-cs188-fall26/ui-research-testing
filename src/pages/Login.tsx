import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../hooks/useSession";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useSession();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  if (!loading && session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    if (data.session) {
      navigate(from, { replace: true });
    } else {
      // Happens when email confirmation is enabled in Supabase
      setMessage({
        type: "ok",
        text: "Check your email to confirm your account, then sign in.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        {message && (
          <p
            className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
