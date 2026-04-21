"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Mail, Check, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mini-demo de redaction IA. Simule un email qui s ecrit tout seul, avec
 * plusieurs exemples qui tournent en boucle (FR/EN/ES).
 *
 * Usage :
 *   <AITypingDemo />
 *
 * Aucun appel reseau, 100% local, fait pour illustrer sur une page marketing.
 */

type Sample = {
  language: "fr" | "en" | "es";
  to: string;
  company: string;
  subject: string;
  body: string;
};

const SAMPLES: Sample[] = [
  {
    language: "fr",
    to: "Camille · Pâtisserie Lumière",
    company: "Paris, FR",
    subject: "Un cacao d'origine pour vos collections 2026",
    body:
      "Bonjour Camille,\n\nJ'ai vu que vous travaillez de beaux chocolats monocépages chez Pâtisserie Lumière. Nous produisons un beurre de cacao et une poudre premium d'origine Côte d'Ivoire, tracables de la plantation à la livraison.\n\nSeriez-vous ouvert à un échantillon gratuit pour vos prochaines créations ?",
  },
  {
    language: "en",
    to: "David · Nordic Roastery",
    company: "Copenhagen, DK",
    subject: "Single-origin green coffee for your 2026 line",
    body:
      "Hi David,\n\nI noticed Nordic Roastery focuses on specialty light roasts. We ship traceable single-origin green coffee from Côte d'Ivoire — clean cup, bright acidity, strong farmer partnerships.\n\nHappy to send a free 200g sample for your next cupping session.",
  },
  {
    language: "es",
    to: "Ana · Chocolatería Sol",
    company: "Barcelona, ES",
    subject: "Manteca de cacao trazable para sus chocolates premium",
    body:
      "Hola Ana,\n\nSus bombones de origen único llaman la atención. Producimos manteca de cacao y polvo 100% trazables desde Costa de Marfil, con certificación orgánica.\n\n¿Le interesaría una muestra gratuita para su próxima colección ?",
  },
];

const TYPE_SPEED_MS = 18;
const PAUSE_AFTER_TYPING_MS = 3600;
const SUBJECT_TO_BODY_DELAY_MS = 320;

export function AITypingDemo({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<"subject" | "body" | "done">("subject");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sample = SAMPLES[index];

  // Reset quand on change d exemple (boucle)
  useEffect(() => {
    setSubject("");
    setBody("");
    setPhase("subject");
  }, [index]);

  // Frappe de l objet puis du corps
  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (phase === "subject") {
      if (subject.length < sample.subject.length) {
        typingTimerRef.current = setTimeout(() => {
          setSubject(sample.subject.slice(0, subject.length + 1));
        }, TYPE_SPEED_MS);
      } else {
        typingTimerRef.current = setTimeout(
          () => setPhase("body"),
          SUBJECT_TO_BODY_DELAY_MS
        );
      }
    } else if (phase === "body") {
      if (body.length < sample.body.length) {
        // Leger ralenti sur les retours a la ligne et la ponctuation pour un rendu naturel
        const nextChar = sample.body[body.length];
        const delay =
          nextChar === "\n"
            ? 220
            : nextChar === "." || nextChar === ","
              ? 90
              : TYPE_SPEED_MS + Math.random() * 18;
        typingTimerRef.current = setTimeout(() => {
          setBody(sample.body.slice(0, body.length + 1));
        }, delay);
      } else {
        // Fin de la frappe du corps : on passe en "done".
        // Le passage a l exemple suivant est gere dans un useEffect separe
        // (sinon le cleanup de ce useEffect annule le timer de boucle).
        setPhase("done");
      }
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [phase, subject, body, sample]);

  // Boucle : quand un exemple est termine, on attend puis on passe au suivant
  useEffect(() => {
    if (phase !== "done") return;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % SAMPLES.length);
    }, PAUSE_AFTER_TYPING_MS);
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, [phase]);

  const isTyping = phase !== "done";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur",
        className
      )}
    >
      {/* header: envelope + ai pill */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <div className="leading-tight">
            <p className="font-medium text-white">Brouillon · IA</p>
            <p className="text-[10px] text-neutral-400">
              Pour {sample.to} · {sample.company}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-100">
          {isTyping ? (
            <>
              <Sparkles className="h-3 w-3 animate-pulse" />
              Rédaction…
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              Prêt
            </>
          )}
        </div>
      </div>

      {/* subject */}
      <div className="mb-2">
        <p className="text-[10px] uppercase tracking-wide text-neutral-400">
          Objet
        </p>
        <p className="text-sm font-semibold text-white">
          {subject}
          {phase === "subject" && <BlinkingCursor />}
        </p>
      </div>

      {/* body */}
      <div className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="text-[10px] uppercase tracking-wide text-neutral-400">
          Message
        </p>
        <pre className="max-h-40 min-h-[8.5rem] overflow-hidden whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-100">
{body}
          {phase === "body" && <BlinkingCursor />}
          {phase === "done" && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <Check className="h-3 w-3" /> généré par IA
            </span>
          )}
        </pre>
      </div>

      {/* footer: model row */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-400">
        <div className="inline-flex items-center gap-1">
          <Bot className="h-3 w-3 text-violet-300" />
          Claude 3.5 · ton commercial
        </div>
        <div className="inline-flex items-center gap-2 uppercase tracking-wide">
          {/* Pastilles de progression (boucle infinie) */}
          <div className="flex items-center gap-0.5">
            {SAMPLES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === index
                    ? "w-4 bg-violet-400"
                    : "w-1.5 bg-white/20"
                )}
              />
            ))}
          </div>
          <span className="inline-flex items-center gap-1">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                isTyping ? "animate-pulse bg-amber-400" : "bg-emerald-400"
              )}
            />
            {sample.language.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-[1.5px] translate-y-0.5 animate-pulse bg-violet-300 align-middle"
    />
  );
}

export default AITypingDemo;
