"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await signIn("credentials", {
            email: form.get("email"),
            password: form.get("password"),
            redirect: false
          });
          if (result?.ok) {
            router.push("/");
            router.refresh();
          } else {
            setError("Email sau parolă incorectă.");
          }
        });
      }}
    >
      <label>
        Email
        <input className="field" name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Parolă
        <input className="field" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <div className="notice bad">{error}</div> : null}
      <button className="btn" disabled={pending} type="submit">
        {pending ? "Se autentifică…" : "Intră în garaj"}
      </button>
    </form>
  );
}
