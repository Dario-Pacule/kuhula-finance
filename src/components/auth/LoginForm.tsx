"use client";

import { useState, useTransition } from "react";
import { login, register } from "@/lib/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm() {
  const [mode, setMode]             = useState<"login" | "register">("login");
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [showPassword, setShowPass] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = mode === "login"
        ? await login(formData)
        : await register(formData);

      if (result && "error" in result)   setError(result.error);
      if (result && "success" in result) setSuccess(result.success);
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">

      {/* Tabs */}
      <div className="flex bg-zinc-950 rounded-xl p-1 gap-1">
        {(["login", "register"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => { setMode(tab); setError(null); setSuccess(null); }}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
              mode === tab
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Nome
            </label>
            <input
              name="displayName"
              type="text"
              required
              placeholder="O teu nome"
              className="bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-[12.5px] text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            E-mail
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="exemplo@email.com"
            className="bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-[12.5px] text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 pr-10 text-[12.5px] text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-[12px] rounded-xl py-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="text-[10px] text-zinc-600 text-center">
        Os teus dados estão protegidos e são privados.
      </p>
    </div>
  );
}
