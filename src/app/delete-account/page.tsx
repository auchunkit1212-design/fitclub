"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";
import { DeleteAccountPanel } from "@/components/DeleteAccountPanel";
import { useI18n } from "@/components/I18nProvider";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-white pb-12 max-w-lg mx-auto">
      <PageHeader
        title={t("legal.deleteAccount", "刪除帳戶")}
        onBack={() => router.back()}
      />

      <main className="px-4 py-5 space-y-6">
        <DeleteAccountPanel />
        <LegalFooterLinks showDeleteAccount={false} />
      </main>
    </div>
  );
}
