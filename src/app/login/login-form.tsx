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
      className="grid gap-4"
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
            setError("Email sau parola incorecta.");
          }
        });
      }}
    >
      <label>
        <span className="label">Email</span>
        <input className="field" name="email" type="email" required />
      </label>
      <label>
        <span className="label">Parola</span>
        <input className="field" name="password" type="password" required />
      </label>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <button className="btn" disabled={pending} type="submit">
        {pending ? "Se autentifica..." : "Login"}
      </button>
    </form>
  );
}
