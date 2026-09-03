"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { useI18n } from "@/components/I18nProvider";
import { LEGAL_LAST_UPDATED, getLegalContactEmail } from "@/lib/legal-config";
import { getLegalDocument, type LegalDocId } from "@/lib/legal-content";

interface LegalDocViewProps {
  docId: LegalDocId;
}

export function LegalDocView({ docId }: LegalDocViewProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const doc = getLegalDocument(docId, lang);
  const contact = getLegalContactEmail();

  return (
    <div className="min-h-screen bg-white pb-12 max-w-lg mx-auto">
      <PageHeader
        title={doc.title}
        onBack={() => router.back()}
        subtitle={t("legal.lastUpdated", "最後更新：{date}", {
          date: LEGAL_LAST_UPDATED,
        })}
      />

      <main className="px-4 py-5 space-y-6">
        <p className="text-sm text-zinc-600 leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {section.title}
            </h2>
            <ul className="space-y-2">
              {section.paragraphs.map((p) => (
                <li
                  key={p.slice(0, 40)}
                  className="text-sm text-zinc-600 leading-relaxed pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-emerald-600"
                >
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">
            {t("legal.contactTitle", "聯絡我們")}
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            {t(
              "legal.contactBody",
              "如有私隱或帳戶問題，請電郵："
            )}{" "}
            <a
              href={`mailto:${contact}`}
              className="text-emerald-700 font-medium underline break-all"
            >
              {contact}
            </a>
          </p>
        </section>

        <LegalFooterLinks className="pt-2" hideCurrent={docId} />
      </main>
    </div>
  );
}
