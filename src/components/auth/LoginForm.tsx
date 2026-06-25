"use client";

import { useState, useTransition } from "react";
import { login, register, recoverPassword, updatePassword } from "@/lib/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface LoginFormProps {
  isResetMode?: boolean;
}

export function LoginForm({ isResetMode = false }: LoginFormProps) {
  const [mode, setMode]             = useState<"login" | "register" | "recover" | "reset">(
    isResetMode ? "reset" : "login"
  );
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
      let result;
      if (mode === "login") {
        result = await login(formData);
      } else if (mode === "register") {
        result = await register(formData);
      } else if (mode === "recover") {
        result = await recoverPassword(formData);
      } else if (mode === "reset") {
        result = await updatePassword(formData);
      }

      if (result && "error" in result)   setError(result.error ?? null);
      if (result && "success" in result) {
        setSuccess(result.success ?? null);
        if (mode === "reset") {
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
        }
      }
    });
  };

  const showTabs = mode === "login" || mode === "register";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">

      {/* Title for non-tab modes */}
      {!showTabs && (
        <div className="text-center">
          <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
            {mode === "recover" ? "Recuperar palavra-passe" : "Nova palavra-passe"}
          </h2>
          <p className="text-[10.5px] text-zinc-500 mt-1">
            {mode === "recover" 
              ? "Introduz o teu e-mail para receberes o link de redefinição."
              : "Escolhe uma nova palavra-passe segura para a tua conta."
            }
          </p>
        </div>
      )}

      {/* Tabs */}
      {showTabs && (
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
      )}

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

        {(mode === "login" || mode === "register" || mode === "recover") && (
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
        )}

        {(mode === "login" || mode === "register" || mode === "reset") && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                {mode === "reset" ? "Nova Password" : "Password"}
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setMode("recover"); setError(null); setSuccess(null); }}
                  className="text-[9.5px] text-zinc-500 hover:text-zinc-300 transition-colors outline-none cursor-pointer"
                >
                  Esqueceste-te da password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder={mode === "reset" ? "Mínimo 6 caracteres" : "Introduz a tua password"}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 pr-10 text-[12.5px] text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

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
          className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-[12px] rounded-xl py-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 cursor-pointer"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === "login" ? "Entrar" :
           mode === "register" ? "Criar conta" :
           mode === "recover" ? "Enviar link de recuperação" :
           "Salvar Nova Password"}
        </button>

        {mode === "recover" && (
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors mt-1 self-center cursor-pointer"
          >
            Voltar para Login
          </button>
        )}
      </form>

      <p className="text-[10px] text-zinc-600 text-center">
        Os teus dados estão protegidos e são privados.
      </p>
    </div>
  );
}
