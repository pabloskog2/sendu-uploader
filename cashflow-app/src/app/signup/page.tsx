"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);

    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold text-brand mb-1">Crea tu empresa</h1>
        <p className="text-sm text-slate-500 mb-6">
          Sendu Flujo de Caja también sirve para tus clientes: cada empresa tiene sus propios datos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre de la empresa</label>
            <input
              className="input"
              required
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Tu nombre</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Correo</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-expense">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-6 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
