"use client";

import { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  Tv2,
  Smartphone,
  BarChart3,
  Languages,
  UserCog,
  Send,
  Phone,
  Percent,
  Check,
  X,
} from "lucide-react";
import { LANDING, demoSlug, type Lang } from "@/lib/landing-content";

const FEATURE_ICONS = [Smartphone, QrCode, Tv2, UserCog, Send, BarChart3, Languages, Percent];

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const t = LANDING[lang];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-900/80 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="text-lg font-semibold tracking-tight">
            Men<span className="text-amber-500">o</span>ra
          </div>
          <nav className="hidden gap-8 text-sm text-neutral-400 sm:flex">
            <a href="#features" className="transition hover:text-neutral-100">{t.nav.features}</a>
            <a href="#pricing" className="transition hover:text-neutral-100">{t.nav.pricing}</a>
            <a href="#faq" className="transition hover:text-neutral-100">{t.nav.faq}</a>
            <a href="#contact" className="transition hover:text-neutral-100">{t.nav.contact}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-full border border-neutral-700 text-xs">
              <button
                onClick={() => setLang("ru")}
                className="px-2.5 py-1 font-medium transition"
                style={lang === "ru" ? { background: "#f59e0b", color: "#0a0a0a" } : { color: "#a3a3a3" }}
              >
                RU
              </button>
              <button
                onClick={() => setLang("uz")}
                className="px-2.5 py-1 font-medium transition"
                style={lang === "uz" ? { background: "#f59e0b", color: "#0a0a0a" } : { color: "#a3a3a3" }}
              >
                UZ
              </button>
            </div>
            <a
              href="#contact"
              className="hidden rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 sm:block"
            >
              {t.hero.ctaPrimary}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <p className="mb-4 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-amber-400">
            {t.hero.eyebrow}
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            {t.hero.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-neutral-400">{t.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#contact"
              className="rounded-lg bg-amber-500 px-6 py-3 text-sm font-medium text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
            >
              {t.hero.ctaPrimary}
            </a>
            <Link
              href={`/${demoSlug}`}
              target="_blank"
              className="rounded-lg border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-200 transition hover:border-amber-500 hover:text-amber-400"
            >
              {t.hero.ctaSecondary}
            </Link>
          </div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4 border-t border-neutral-900 pt-8">
            {t.stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-semibold text-amber-400 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.audience.map((a) => (
            <div
              key={a.title}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-700"
            >
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold sm:text-3xl">
          {lang === "ru" ? "Как это работает" : "Bu qanday ishlaydi"}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          {t.steps.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-neutral-950">
                {i + 1}
              </div>
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold sm:text-3xl">{t.nav.features}</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
            return (
              <div
                key={f.title}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-amber-500/40"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Icon className="text-amber-500" size={20} />
                </div>
                <p className="font-medium">{f.title}</p>
                <p className="mt-1 text-sm text-neutral-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold sm:text-3xl">{t.comparison.title}</h2>
        <div className="overflow-hidden rounded-2xl border border-neutral-800">
          <div className="grid grid-cols-2 border-b border-neutral-800 bg-neutral-900 text-sm font-medium">
            <div className="flex items-center gap-2 px-5 py-3 text-neutral-500">
              <X size={16} className="text-neutral-600" /> {lang === "ru" ? "Бумажное меню" : "Qog'oz menyu"}
            </div>
            <div className="flex items-center gap-2 border-l border-neutral-800 px-5 py-3 text-amber-400">
              <Check size={16} /> Menora
            </div>
          </div>
          {t.comparison.items.map((row, i) => (
            <div
              key={row.old}
              className={`grid grid-cols-2 text-sm ${i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/50"}`}
            >
              <div className="px-5 py-4 text-neutral-500">{row.old}</div>
              <div className="border-l border-neutral-800 px-5 py-4 text-neutral-200">{row.new}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold sm:text-3xl">{t.nav.pricing}</h2>
        <div className="rounded-2xl border border-amber-500/40 bg-neutral-900 p-8 shadow-xl shadow-amber-500/5 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <p className="text-sm text-neutral-400">{t.pricing.description}</p>
            <div className="mt-5 flex flex-wrap items-end justify-center gap-x-8 gap-y-4">
              <div>
                <p className="text-5xl font-semibold tracking-tight">{t.pricing.setupPrice}</p>
                <p className="mt-1 text-sm font-medium text-amber-400">{t.pricing.setupLabel}</p>
              </div>
              <p className="pb-2 text-2xl text-neutral-600">+</p>
              <div>
                <p className="text-5xl font-semibold tracking-tight">{t.pricing.monthlyPrice}</p>
                <p className="mt-1 text-sm font-medium text-amber-400">{t.pricing.monthlyLabel}</p>
              </div>
            </div>
          </div>
          <ul className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-x-6 gap-y-3 text-sm text-neutral-300 sm:grid-cols-2">
            {t.pricing.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-amber-500" />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="mt-8 block rounded-lg bg-amber-500 px-4 py-3 text-center text-sm font-medium text-neutral-950 transition hover:bg-amber-400"
          >
            {t.hero.ctaPrimary}
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold sm:text-3xl">{t.nav.faq}</h2>
        <div className="space-y-3">
          {t.faq.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 p-5 open:border-neutral-700"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {item.q}
                <span className="ml-4 text-neutral-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-neutral-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="mb-3 text-2xl font-semibold sm:text-3xl">{t.contact.heading}</h2>
        <p className="mb-8 text-neutral-400">{t.contact.subheading}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={t.contact.telegram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-amber-400"
          >
            <Send size={16} /> {t.contact.telegramLabel}
          </a>
          <a
            href={`tel:${t.contact.phone.replace(/\s+/g, "")}`}
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-amber-500 hover:text-amber-400"
          >
            <Phone size={16} /> {t.contact.phone}
          </a>
        </div>
      </section>

      <footer className="border-t border-neutral-900 py-8 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} {t.footer}
      </footer>
    </div>
  );
}
