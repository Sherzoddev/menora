"use client";

import { useState } from "react";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
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
  Truck,
  Store,
  UtensilsCrossed,
  Bell,
  PackageMinus,
  RefreshCcw,
  ArrowUpRight,
} from "lucide-react";
import { LANDING, demoSlug, type Lang } from "@/lib/landing-content";

const display = Fraunces({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

const FEATURE_ICONS = [Smartphone, QrCode, Tv2, UserCog, BarChart3, Languages, Percent];
const ORDER_ICONS = [Truck, Store, UtensilsCrossed];
const VELORA_ICONS = [RefreshCcw, Bell, PackageMinus];

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const t = LANDING[lang];

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen`}
      style={{
        background: "#15100C",
        color: "#F3ECE3",
        fontFamily: "var(--font-body)",
      }}
    >
      <style jsx global>{`
        .font-display {
          font-family: var(--font-display);
        }
        details > summary::-webkit-details-marker {
          display: none;
        }
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{ background: "#15100Ccc", borderBottom: "1px solid #2E2219" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="font-display flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold"
              style={{ background: "#E1592C", color: "#15100C" }}
            >
              M
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Menora</span>
          </div>
          <nav className="hidden gap-8 text-sm sm:flex" style={{ color: "#B7A48F" }}>
            <a href="#telegram" className="transition hover:text-[#F3ECE3]">{lang === "ru" ? "Telegram" : "Telegram"}</a>
            <a href="#velora" className="transition hover:text-[#F3ECE3]">Velora</a>
            <a href="#pricing" className="transition hover:text-[#F3ECE3]">{t.nav.pricing}</a>
            <a href="#faq" className="transition hover:text-[#F3ECE3]">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-full text-xs" style={{ border: "1px solid #3A2C20" }}>
              <button
                onClick={() => setLang("ru")}
                className="px-2.5 py-1 font-semibold transition"
                style={lang === "ru" ? { background: "#E1592C", color: "#15100C" } : { color: "#B7A48F" }}
              >
                RU
              </button>
              <button
                onClick={() => setLang("uz")}
                className="px-2.5 py-1 font-semibold transition"
                style={lang === "uz" ? { background: "#E1592C", color: "#15100C" } : { color: "#B7A48F" }}
              >
                UZ
              </button>
            </div>
            <a
              href="#contact"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold transition sm:block"
              style={{ background: "#E1592C", color: "#15100C" }}
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
          className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{ background: "#E1592C14" }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p
              className="mb-5 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
              style={{ background: "#E1592C1A", color: "#EB8354", border: "1px solid #E1592C33" }}
            >
              {t.hero.eyebrow}
            </p>
            <h1 className="font-display text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-balance text-lg" style={{ color: "#B7A48F" }}>
              {t.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#contact"
                className="rounded-lg px-6 py-3 text-sm font-semibold shadow-lg transition hover:brightness-110"
                style={{ background: "#E1592C", color: "#15100C", boxShadow: "0 12px 30px -12px #E1592C66" }}
              >
                {t.hero.ctaPrimary}
              </a>
              <Link
                href={`/${demoSlug}`}
                target="_blank"
                className="rounded-lg px-6 py-3 text-sm font-semibold transition"
                style={{ border: "1px solid #3A2C20", color: "#F3ECE3" }}
              >
                {t.hero.ctaSecondary} →
              </Link>
            </div>

            <div className="mt-14 grid max-w-lg grid-cols-3 gap-4 pt-7" style={{ borderTop: "1px solid #2E2219" }}>
              {t.stats.map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl font-semibold sm:text-3xl" style={{ color: "#EB8354" }}>
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm" style={{ color: "#8A7A68" }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <PhoneMockup lang={lang} />
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.audience.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl p-5 transition"
              style={{ border: "1px solid #2E2219", background: "#1B140F" }}
            >
              <p className="font-display font-semibold">{a.title}</p>
              <p className="mt-1 text-xs" style={{ color: "#8A7A68" }}>
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading>{lang === "ru" ? "Как это работает" : "Bu qanday ishlaydi"}</SectionHeading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          {t.steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl p-5" style={{ border: "1px solid #2E2219", background: "#1B140F" }}>
              <div
                className="font-display mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: "#E1592C", color: "#15100C" }}
              >
                {i + 1}
              </div>
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm" style={{ color: "#8A7A68" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Telegram ordering spotlight */}
      <section id="telegram" className="mx-auto max-w-6xl px-6 py-16">
        <div
          className="grid grid-cols-1 gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-[1fr_0.9fr] lg:items-center"
          style={{ background: "linear-gradient(155deg, #1B140F 0%, #201812 100%)", border: "1px solid #2E2219" }}
        >
          <div>
            <SpotlightEyebrow icon={Send}>{t.telegramOrdering.eyebrow}</SpotlightEyebrow>
            <h2 className="font-display text-balance mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
              {t.telegramOrdering.title}
            </h2>
            <p className="mt-4 max-w-lg text-sm sm:text-base" style={{ color: "#B7A48F" }}>
              {t.telegramOrdering.subtitle}
            </p>
            <div className="mt-8 space-y-5">
              {t.telegramOrdering.points.map((p, i) => {
                const Icon = ORDER_ICONS[i % ORDER_ICONS.length];
                return (
                  <div key={p.title} className="flex gap-3.5">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "#E1592C1A" }}
                    >
                      <Icon size={17} style={{ color: "#EB8354" }} />
                    </span>
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="mt-0.5 text-sm" style={{ color: "#8A7A68" }}>
                        {p.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ChatMockup lang={lang} />
        </div>
      </section>

      {/* Velora integration spotlight */}
      <section id="velora" className="mx-auto max-w-6xl px-6 py-8">
        <div
          className="grid grid-cols-1 gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-[0.9fr_1fr] lg:items-center"
          style={{ background: "#151E1A", border: "1px solid #223027" }}
        >
          <div className="order-2 lg:order-1">
            <VeloraTabMockup />
          </div>
          <div className="order-1 lg:order-2">
            <SpotlightEyebrow icon={RefreshCcw} tone="green">
              {t.veloraIntegration.eyebrow}
            </SpotlightEyebrow>
            <h2 className="font-display text-balance mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
              {t.veloraIntegration.title}
            </h2>
            <p className="mt-4 max-w-lg text-sm sm:text-base" style={{ color: "#9FB0A6" }}>
              {t.veloraIntegration.subtitle}
            </p>
            <div className="mt-8 space-y-5">
              {t.veloraIntegration.points.map((p, i) => {
                const Icon = VELORA_ICONS[i % VELORA_ICONS.length];
                return (
                  <div key={p.title} className="flex gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "#34C7591A" }}>
                      <Icon size={17} style={{ color: "#4ADE80" }} />
                    </span>
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="mt-0.5 text-sm" style={{ color: "#8FA096" }}>
                        {p.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <a
              href={t.veloraIntegration.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
              style={{ background: "#34C759", color: "#0B1510" }}
            >
              {t.veloraIntegration.linkLabel} <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading>{t.nav.features}</SectionHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.features
            .filter((f) => !f.title.toLowerCase().includes("telegram") && !f.title.toLowerCase().includes("orqali"))
            .map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <div key={f.title} className="rounded-2xl p-6 transition" style={{ border: "1px solid #2E2219", background: "#1B140F" }}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "#E1592C1A" }}>
                    <Icon style={{ color: "#EB8354" }} size={20} />
                  </div>
                  <p className="font-medium">{f.title}</p>
                  <p className="mt-1 text-sm" style={{ color: "#8A7A68" }}>
                    {f.desc}
                  </p>
                </div>
              );
            })}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <SectionHeading>{t.comparison.title}</SectionHeading>
        <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid #2E2219" }}>
          <div className="grid grid-cols-2 text-sm font-medium" style={{ background: "#1B140F", borderBottom: "1px solid #2E2219" }}>
            <div className="flex items-center gap-2 px-5 py-3" style={{ color: "#8A7A68" }}>
              <X size={16} style={{ color: "#5A4A3B" }} /> {lang === "ru" ? "Бумажное меню" : "Qog'oz menyu"}
            </div>
            <div className="flex items-center gap-2 px-5 py-3" style={{ borderLeft: "1px solid #2E2219", color: "#EB8354" }}>
              <Check size={16} /> Menora
            </div>
          </div>
          {t.comparison.items.map((row, i) => (
            <div key={row.old} className="grid grid-cols-2 text-sm" style={{ background: i % 2 === 0 ? "#15100C" : "#1B140F80" }}>
              <div className="px-5 py-4" style={{ color: "#8A7A68" }}>
                {row.old}
              </div>
              <div className="px-5 py-4" style={{ borderLeft: "1px solid #2E2219", color: "#F3ECE3" }}>
                {row.new}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeading>{t.nav.pricing}</SectionHeading>
        <div className="rounded-3xl p-8 sm:p-10" style={{ border: "1px solid #E1592C40", background: "#1B140F", boxShadow: "0 20px 60px -30px #E1592C33" }}>
          <div className="flex flex-col items-center text-center">
            <p className="text-sm" style={{ color: "#8A7A68" }}>
              {t.pricing.description}
            </p>
            <div className="mt-5 flex flex-wrap items-end justify-center gap-x-8 gap-y-4">
              <div>
                <p className="font-display text-5xl font-semibold tracking-tight">{t.pricing.setupPrice}</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "#EB8354" }}>
                  {t.pricing.setupLabel}
                </p>
              </div>
              <p className="pb-2 text-2xl" style={{ color: "#4A3B2E" }}>
                +
              </p>
              <div>
                <p className="font-display text-5xl font-semibold tracking-tight">{t.pricing.monthlyPrice}</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "#EB8354" }}>
                  {t.pricing.monthlyLabel}
                </p>
              </div>
            </div>
          </div>
          <ul className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2" style={{ color: "#D8CBBC" }}>
            {t.pricing.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#E1592C" }} />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="mt-8 block rounded-lg px-4 py-3 text-center text-sm font-semibold transition hover:brightness-110"
            style={{ background: "#E1592C", color: "#15100C" }}
          >
            {t.hero.ctaPrimary}
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeading>{t.nav.faq}</SectionHeading>
        <div className="space-y-3">
          {t.faq.map((item) => (
            <details key={item.q} className="group rounded-2xl p-5" style={{ border: "1px solid #2E2219", background: "#1B140F" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {item.q}
                <span className="ml-4 text-lg transition group-open:rotate-45" style={{ color: "#8A7A68" }}>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm" style={{ color: "#8A7A68" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t.contact.heading}</h2>
        <p className="mx-auto mt-3 max-w-md" style={{ color: "#8A7A68" }}>
          {t.contact.subheading}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={t.contact.telegram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
            style={{ background: "#E1592C", color: "#15100C" }}
          >
            <Send size={16} /> {t.contact.telegramLabel}
          </a>
          <a
            href={`tel:${t.contact.phone.replace(/\s+/g, "")}`}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition"
            style={{ border: "1px solid #3A2C20", color: "#F3ECE3" }}
          >
            <Phone size={16} /> {t.contact.phone}
          </a>
        </div>
      </section>

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid #2E2219", color: "#5A4A3B" }}>
        © {new Date().getFullYear()} {t.footer}
      </footer>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display mb-10 text-center text-2xl font-semibold sm:text-3xl">{children}</h2>;
}

function SpotlightEyebrow({
  icon: Icon,
  tone = "amber",
  children,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  tone?: "amber" | "green";
  children: React.ReactNode;
}) {
  const color = tone === "amber" ? "#EB8354" : "#4ADE80";
  const bg = tone === "amber" ? "#E1592C1A" : "#34C7591A";
  return (
    <p className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ background: bg, color }}>
      <Icon size={13} style={{ color }} /> {children}
    </p>
  );
}

// Illustrative phone screen — mirrors the real bilingual public menu (see
// /[slug]), built from actual seeded catalog items rather than lorem, so the
// hero shows the real product instead of a generic mockup.
function PhoneMockup({ lang }: { lang: Lang }) {
  const dishes =
    lang === "ru"
      ? [
          { name: "Чизбургер", desc: "Говяжья котлета, чеддер, свежие овощи", price: "25 000" },
          { name: "BBQ Doger", desc: "Фирменный соус барбекю", price: "20 000" },
          { name: "Комбо для двоих", desc: "2 шаурмы + картофель + 2 напитка", price: "95 000" },
        ]
      : [
          { name: "Chizburger", desc: "Mol go'shti kotleti, chedder, sabzavotlar", price: "25 000" },
          { name: "BBQ Doger", desc: "Maxsus barbekyu sousi", price: "20 000" },
          { name: "Ikkovlashib combo", desc: "2 shaurma + kartoshka + 2 ichimlik", price: "95 000" },
        ];
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div className="rounded-[2.5rem] p-3" style={{ background: "#0D0906", border: "1px solid #2E2219", boxShadow: "0 30px 80px -30px #00000080" }}>
        <div className="overflow-hidden rounded-[1.9rem]" style={{ background: "#F6EEE2" }}>
          <div className="px-5 pb-5 pt-6" style={{ background: "#1B140F" }}>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold" style={{ color: "#F3ECE3" }}>
                Test
              </span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#E1592C", color: "#15100C" }}>
                RU / UZ
              </span>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "#8A7A68" }}>
              {lang === "ru" ? "Шаурма и фастфуд" : "Shaurma va fast-fud"}
            </p>
          </div>
          <div className="space-y-3 p-4">
            {dishes.map((d) => (
              <div key={d.name} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: "#FFFFFF", border: "1px solid #EADFCC" }}>
                <div className="h-12 w-12 shrink-0 rounded-lg" style={{ background: "linear-gradient(135deg, #E1592C, #EB8354)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "#1C140C" }}>
                    {d.name}
                  </p>
                  <p className="truncate text-[10.5px]" style={{ color: "#8A7A68" }}>
                    {d.desc}
                  </p>
                </div>
                <p className="shrink-0 text-[12px] font-semibold" style={{ color: "#B8431E" }}>
                  {d.price}
                </p>
              </div>
            ))}
            <div className="rounded-xl py-2.5 text-center text-[12px] font-semibold" style={{ background: "#1B140F", color: "#F3ECE3" }}>
              {lang === "ru" ? "Оформить заказ" : "Buyurtma berish"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMockup({ lang }: { lang: Lang }) {
  const rows =
    lang === "ru"
      ? [
          { from: "bot", text: "Заказ №23 принят — доставка, ул. Мирзо Улугбека" },
          { from: "bot", text: "Курьер уже в пути 🛵" },
          { from: "user", text: "Спасибо!" },
        ]
      : [
          { from: "bot", text: "23-buyurtma qabul qilindi — yetkazib berish" },
          { from: "bot", text: "Kuryer allaqachon yo'lda 🛵" },
          { from: "user", text: "Rahmat!" },
        ];
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl p-4" style={{ background: "#15100C", border: "1px solid #2E2219" }}>
      <div className="mb-3 flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid #2E2219" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "#229ED9" }}>
          <Send size={13} color="#fff" />
        </span>
        <span className="text-xs font-semibold">Menora Bot</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div
            key={i}
            className="max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-snug"
            style={
              r.from === "bot"
                ? { background: "#1B140F", color: "#D8CBBC", marginRight: "auto" }
                : { background: "#E1592C", color: "#15100C", marginLeft: "auto" }
            }
          >
            {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function VeloraTabMockup() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl p-5" style={{ background: "#0F1713", border: "1px solid #223027" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "#F3ECE3" }}>
          Menora: Доставка
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#34C7591A", color: "#4ADE80" }}>
          готов к оплате
        </span>
      </div>
      <div className="mt-4 space-y-2 text-[12px]" style={{ color: "#9FB0A6" }}>
        <div className="flex justify-between">
          <span>1 × Чизбургер</span>
          <span>25 000</span>
        </div>
        <div className="flex justify-between">
          <span>1 × Фанта 0.5</span>
          <span>8 000</span>
        </div>
      </div>
      <div className="mt-4 flex justify-between pt-3 text-sm font-semibold" style={{ borderTop: "1px solid #223027", color: "#F3ECE3" }}>
        <span>Итого</span>
        <span>33 000</span>
      </div>
      <div className="mt-4 rounded-lg py-2 text-center text-[12px] font-semibold" style={{ background: "#34C759", color: "#0B1510" }}>
        Оплатить весь счёт
      </div>
    </div>
  );
}
