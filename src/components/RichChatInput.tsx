"use client";

/**
 * RichChatInput
 *
 * Editor de texto rico para o chat com atalhos markdown automáticos:
 *   - `- ` ou `* `  → bullet list
 *   - `1. `         → numbered list
 *   - `**texto**`   → bold
 *   - `_texto_`     → italic
 *   - `# `          → heading
 *   - `> `          → blockquote
 *
 * Ao enviar, converte o conteúdo de volta para markdown limpo
 * para a IA receber texto puro sem tags HTML.
 */

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Send } from "lucide-react";

// ── Converter conteúdo Tiptap → texto plano/markdown para a IA ──

function editorContentToText(editor: ReturnType<typeof useEditor> | null): string {
  if (!editor) return "";

  const json = editor.getJSON();

  function nodeToText(node: any): string {
    if (!node) return "";

    switch (node.type) {
      case "doc":
        return (node.content ?? []).map(nodeToText).join("\n").trim();

      case "paragraph":
        if (!node.content?.length) return "";
        return (node.content ?? []).map(nodeToText).join("");

      case "bulletList":
        return (node.content ?? [])
          .map((li: any) => "- " + (li.content ?? []).map(nodeToText).join("").trim())
          .join("\n");

      case "orderedList":
        return (node.content ?? [])
          .map((li: any, i: number) => `${i + 1}. ` + (li.content ?? []).map(nodeToText).join("").trim())
          .join("\n");

      case "listItem":
        return (node.content ?? []).map(nodeToText).join("");

      case "blockquote":
        return (node.content ?? [])
          .map((n: any) => "> " + nodeToText(n))
          .join("\n");

      case "heading":
        const level = node.attrs?.level ?? 1;
        return "#".repeat(level) + " " + (node.content ?? []).map(nodeToText).join("");

      case "hardBreak":
        return "\n";

      case "text": {
        let t = node.text ?? "";
        const marks = node.marks ?? [];
        if (marks.find((m: any) => m.type === "bold")) t = `**${t}**`;
        if (marks.find((m: any) => m.type === "italic")) t = `_${t}_`;
        if (marks.find((m: any) => m.type === "code")) t = `\`${t}\``;
        return t;
      }

      default:
        return (node.content ?? []).map(nodeToText).join("");
    }
  }

  return nodeToText(json);
}

// ── Props ─────────────────────────────────────────────────────

interface RichChatInputProps {
  onSend: (text: string) => void;
  isTyping: boolean;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  submitOnEnter: boolean;
  suggestions: string[];
  showSuggestions: boolean;
}

// ── Componente ────────────────────────────────────────────────

export function RichChatInput({
  onSend,
  isTyping,
  hasApiKey,
  onOpenSettings,
  submitOnEnter,
  suggestions,
  showSuggestions,
}: RichChatInputProps) {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Activa atalhos markdown automáticos
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Fala comigo sobre as tuas finanças…",
      }),
      Typography, // Converte automaticamente -- em —, ... em …, etc.
    ],
    editorProps: {
      attributes: {
        class: "focus:outline-none text-zinc-100 text-[12.5px] leading-relaxed min-h-[44px] max-h-[200px] overflow-y-auto px-4 py-3",
      },
      handleKeyDown(view, event) {
        if (event.key === "Enter" && !event.shiftKey && submitOnEnter) {
          const text = editorContentToText(editorRef.current ?? null);
          if (text.trim()) {
            event.preventDefault();
            handleSend();
            return true;
          }
        }
        return false;
      },
    },
    content: "",
  });

  // Guardar ref do editor para acesso no handleKeyDown
  useEffect(() => {
    if (editor) (editorRef as any).current = editor;
  }, [editor]);

  const handleSend = () => {
    if (!editor) return;
    const text = editorContentToText(editor);
    if (!text.trim()) return;
    onSend(text);
    editor.commands.clearContent();
    // Reset altura
    const el = editor.view.dom as HTMLElement;
    el.style.height = "44px";
  };

  const isEmpty = editor?.isEmpty ?? true;

  return (
    <div className="px-3 pb-3 pt-2 bg-zinc-950">

      {/* Sugestões — só quando chat vazio */}
      {showSuggestions && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {suggestions.map((text, idx) => (
            <button
              key={idx}
              onClick={() => onSend(text)}
              className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 text-[10px] text-zinc-400 hover:text-zinc-200 rounded-full transition-all"
            >
              {text.length > 32 ? text.substring(0, 32) + "…" : text}
            </button>
          ))}
        </div>
      )}

      {/* Container do editor */}
      <div className={`flex flex-col bg-zinc-900 border rounded-2xl transition-all duration-150 ${
        !isEmpty ? "border-zinc-600 shadow-lg shadow-black/20" : "border-zinc-800"
      }`}>

        {/* Barra de formatação — só aparece quando há conteúdo */}
        {!isEmpty && editor && (
          <div className="flex items-center gap-0.5 px-3 pt-2.5 pb-1 border-b border-zinc-800/60">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="Negrito (Ctrl+B)"
            >
              <span className="font-bold text-[11px]">B</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="Itálico (Ctrl+I)"
            >
              <span className="italic text-[11px]">I</span>
            </ToolbarButton>
            <div className="w-px h-3.5 bg-zinc-700 mx-1" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="Lista com pontos"
            >
              <span className="text-[11px]">• —</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="Lista numerada"
            >
              <span className="text-[11px]">1.</span>
            </ToolbarButton>
            <div className="w-px h-3.5 bg-zinc-700 mx-1" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              title="Citação"
            >
              <span className="text-[11px]">"</span>
            </ToolbarButton>
          </div>
        )}

        {/* Editor */}
        <EditorContent editor={editor} />

        {/* Barra inferior */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <span className="text-[9px] text-zinc-600 hidden sm:block">
                Shift+Enter para nova linha · <span className="text-zinc-700">- espaço</span> para lista
              </span>
            )}
          </div>

          {/* Botão enviar */}
          <button
            onClick={handleSend}
            disabled={isEmpty || isTyping}
            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 ${
              !isEmpty && !isTyping
                ? "bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm hover:scale-105 active:scale-95"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {isTyping ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Aviso de API não configurada */}
      {!hasApiKey && (
        <p className="text-center text-[9.5px] text-zinc-600 mt-1.5">
          Configura a chave de API em{" "}
          <button onClick={onOpenSettings} className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
            Definições ⚙️
          </button>
        </p>
      )}

      {/* Estilos do editor Tiptap */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #52525b;
          pointer-events: none;
          height: 0;
          font-size: 12.5px;
        }
        .tiptap ul { list-style-type: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .tiptap ol { list-style-type: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .tiptap li { margin: 0.1rem 0; }
        .tiptap blockquote { border-left: 2px solid #52525b; padding-left: 0.75rem; color: #a1a1aa; margin: 0.25rem 0; }
        .tiptap h1 { font-size: 1rem; font-weight: 700; margin: 0.25rem 0; }
        .tiptap h2 { font-size: 0.9rem; font-weight: 700; margin: 0.25rem 0; }
        .tiptap h3 { font-size: 0.8rem; font-weight: 600; margin: 0.25rem 0; }
        .tiptap strong { font-weight: 700; }
        .tiptap em { font-style: italic; }
        .tiptap code { background: #27272a; border-radius: 3px; padding: 0 3px; font-family: monospace; font-size: 11px; }
        .tiptap p { margin: 0; }
        .tiptap > * + * { margin-top: 0.35rem; }
      `}</style>
    </div>
  );
}

// ── Botão da toolbar ──────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 rounded text-[11px] transition-all ${
        active
          ? "bg-zinc-700 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
