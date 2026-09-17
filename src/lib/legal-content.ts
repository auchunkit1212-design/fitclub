import type { AppLanguage } from "@/lib/i18n";

export type LegalDocId = "privacy" | "terms";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const privacyZhHK: LegalDocument = {
  title: "私隱政策",
  intro:
    "Nutrition Coach（大猩猩飲食助手）重視你的私隱。本政策說明我們收集咩資料、點樣使用、同你享有咩權利。",
  sections: [
    {
      title: "我們收集嘅資料",
      paragraphs: [
        "帳戶資料：電郵地址、顯示名稱、角色（學員／教練）、所屬健身室或教練品牌。",
        "身體同目標資料：身高、體重、年齡、性別、目標體重、運動消耗等（你自願提供）。",
        "飲食記錄：餐次、食物描述、營養估算、相片、打卡時間。",
        "裝置同推播：若你開啟推播提醒，我們會儲存 Web Push 訂閱資訊。",
        "使用資料：語言偏好、提醒設定、連續打卡紀錄。",
      ],
    },
    {
      title: "資料用途",
      paragraphs: [
        "提供飲食記錄、營養估算、AI 覆核同進度儀表板。",
        "讓教練（如有綁定）查看學員打卡、設定目標同發送回覆。",
        "發送飲水／記錄提醒（需你同意推播）。",
        "改善 App 功能同穩定性。",
      ],
    },
    {
      title: "相片、相機同 OCR",
      paragraphs: [
        "記錄飲食或掃描營養標籤時，你可選擇使用相機或上載相片。",
        "相片可能上傳至雲端儲存（Supabase Storage）作記錄同 AI 分析。",
        "我們唔會將你的食物相片公開展示，除非你主動分享到 Community。",
      ],
    },
    {
      title: "AI 處理",
      paragraphs: [
        "部分功能（營養標籤 OCR、AI 覆核、配餐建議）會將你輸入的文字或相片傳送至第三方 AI 服務（例如 OpenRouter／OpenAI）作分析。",
        "AI 估算只供參考，唔構成醫療或營養師專業意見。",
      ],
    },
    {
      title: "資料分享",
      paragraphs: [
        "若你綁定教練／健身室，你的飲食記錄同身體檔案會分享俾負責教練查閱。",
        "Community 分享內容會對其他用戶可見（按你分享設定）。",
        "除法律要求外，我們唔會出售你的個人資料。",
        "基礎設施供應商（例如 Vercel、Supabase）會按服務需要處理資料。",
      ],
    },
    {
      title: "資料保留同刪除",
      paragraphs: [
        "帳戶有效期間，我們會保留你的資料以提供服務。",
        "你可隨時喺「設定 → 刪除帳戶」要求永久刪除帳戶及相關飲食、身體檔案。",
        "刪除後一般無法復原。",
      ],
    },
    {
      title: "你的權利",
      paragraphs: [
        "查閱、更正或刪除個人資料。",
        "關閉推播提醒。",
        "就私隱問題聯絡我們（見頁底電郵）。",
      ],
    },
    {
      title: "兒童私隱",
      paragraphs: [
        "本服務主要面向成人。如未滿 18 歲，請在家長或監護人同意下使用。",
      ],
    },
    {
      title: "政策更新",
      paragraphs: [
        "我們可能更新本政策；重大變更會喺 App 內或註冊頁提示。",
        "繼續使用即表示你接受更新後嘅政策。",
      ],
    },
  ],
};

const termsZhHK: LegalDocument = {
  title: "使用條款",
  intro:
    "使用 Nutrition Coach 即表示你同意以下條款。請先閱讀再註冊或使用。",
  sections: [
    {
      title: "服務說明",
      paragraphs: [
        "Nutrition Coach 係飲食記錄同教練管理工具，提供卡路里／宏量估算、AI 輔助分析同教練互動功能。",
        "本服務唔係醫療器材，唔提供診斷、治療或處方建議。",
      ],
    },
    {
      title: "帳戶責任",
      paragraphs: [
        "你需提供準確嘅註冊資料，並妥善保管登入憑證。",
        "帳戶底下嘅所有操作由你負責。",
        "教練帳戶需對其學員資料處理負合理管理責任。",
      ],
    },
    {
      title: "可接受使用",
      paragraphs: [
        "禁止上載違法、侵權、騷擾或令人反感嘅內容。",
        "禁止嘗試入侵、逆向或干擾服務運作。",
        "禁止虛假打卡或濫用 AI 功能。",
      ],
    },
    {
      title: "營養同健康免責",
      paragraphs: [
        "App 顯示嘅熱量、蛋白質等數據由 AI 或資料庫估算，可能存在誤差。",
        "如有特殊健康狀況、懷孕或飲食限制，請諮詢註冊營養師或醫生。",
        "你因依賴 App 估算而作出嘅飲食決定，風險由你自行承擔。",
      ],
    },
    {
      title: "教練同學員關係",
      paragraphs: [
        "學員綁定教練後，教練可查看相關飲食同身體數據。",
        "教練與學員之間嘅指導關係由雙方自行約定，本平台只提供工具。",
      ],
    },
    {
      title: "知識產權",
      paragraphs: [
        "App 介面、品牌同軟件歸平台或授權方所有。",
        "你上載嘅內容仍屬於你，但授予我們為提供服務而儲存、顯示同處理嘅必要授權。",
      ],
    },
    {
      title: "服務變更同終止",
      paragraphs: [
        "我們可更新、暫停或終止部分功能，並會合理通知。",
        "你可隨時刪除帳戶停止使用。",
      ],
    },
    {
      title: "責任限制",
      paragraphs: [
        "在法律允許範圍內，我們對間接損失、數據誤差或服務中斷不承擔責任。",
        "免費或試用功能按「現狀」提供。",
      ],
    },
    {
      title: "適用法律",
      paragraphs: [
        "本條款受香港特別行政區法律管轄（可按你實際營運主體調整）。",
        "如有爭議，可先聯絡我們協商。",
      ],
    },
  ],
};

function cloneDoc(doc: LegalDocument): LegalDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({ ...s, paragraphs: [...s.paragraphs] })),
  };
}

/** 簡化：台灣用語微調；英文為摘要版（完整版可後補律師審閱） */
export function getLegalDocument(
  docId: LegalDocId,
  lang: AppLanguage
): LegalDocument {
  const base = docId === "privacy" ? privacyZhHK : termsZhHK;
  if (lang === "zh-HK") return cloneDoc(base);

  if (lang === "zh-TW") {
    const tw = cloneDoc(base);
    tw.intro = tw.intro
      .replace(/嘅/g, "的")
      .replace(/唔/g, "不")
      .replace(/俾/g, "給")
      .replace(/喺/g, "在")
      .replace(/睇/g, "看")
      .replace(/撳/g, "點");
    tw.sections = tw.sections.map((s) => ({
      title: s.title
        .replace(/嘅/g, "的")
        .replace(/相片、相機同 OCR/g, "相片、相機與 OCR"),
      paragraphs: s.paragraphs.map((p) =>
        p
          .replace(/嘅/g, "的")
          .replace(/唔/g, "不")
          .replace(/俾/g, "給")
          .replace(/喺/g, "在")
          .replace(/睇/g, "看")
          .replace(/資料/g, "資料")
      ),
    }));
    return tw;
  }

  if (docId === "privacy") {
    return {
      title: "Privacy Policy",
      intro:
        "Nutrition Coach respects your privacy. This policy explains what we collect, how we use it, and your rights.",
      sections: [
        {
          title: "Data we collect",
          paragraphs: [
            "Account: email, display name, role (student/coach), gym or coach brand.",
            "Body & goals: height, weight, age, gender, target weight (voluntary).",
            "Meal logs: meal type, food description, nutrition estimates, photos, timestamps.",
            "Push: Web Push subscription if you enable reminders.",
            "Preferences: language, reminder settings, streak data.",
          ],
        },
        {
          title: "How we use data",
          paragraphs: [
            "Provide meal logging, nutrition estimates, AI review, and dashboards.",
            "Allow linked coaches to view student logs and set targets.",
            "Send optional meal/water reminders.",
            "Improve reliability and features.",
          ],
        },
        {
          title: "Camera, photos & OCR",
          paragraphs: [
            "You may use the camera or upload photos for meals or nutrition labels.",
            "Photos may be stored in cloud storage (Supabase) for records and AI analysis.",
            "Photos are not public unless you share to Community.",
          ],
        },
        {
          title: "AI processing",
          paragraphs: [
            "OCR, nutrition verification, and recommendations may send text/images to third-party AI providers (e.g. OpenRouter/OpenAI).",
            "AI output is informational only—not medical or dietitian advice.",
          ],
        },
        {
          title: "Sharing",
          paragraphs: [
            "Linked coaches can access your meal and body profile data.",
            "Community posts are visible to other users per your sharing choice.",
            "We do not sell personal data except as required by law.",
            "Infrastructure providers (Vercel, Supabase) process data as needed.",
          ],
        },
        {
          title: "Retention & deletion",
          paragraphs: [
            "We retain data while your account is active.",
            "You may permanently delete your account in Settings → Delete account.",
            "Deletion is generally irreversible.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "Access, correct, or delete personal data.",
            "Disable push notifications.",
            "Contact us for privacy requests (see footer email).",
          ],
        },
        {
          title: "Children",
          paragraphs: [
            "The service is intended for adults. Users under 18 should use with guardian consent.",
          ],
        },
        {
          title: "Updates",
          paragraphs: [
            "We may update this policy; material changes will be communicated in-app.",
            "Continued use means acceptance of the updated policy.",
          ],
        },
      ],
    };
  }

  return {
    title: "Terms of Service",
    intro: "By using Nutrition Coach you agree to these terms.",
    sections: [
      {
        title: "Service",
        paragraphs: [
          "Nutrition Coach is a meal logging and coach management tool with AI-assisted estimates.",
          "It is not a medical device and does not provide diagnosis or treatment.",
        ],
      },
      {
        title: "Your account",
        paragraphs: [
          "Provide accurate registration information and keep credentials secure.",
          "You are responsible for activity under your account.",
          "Coaches must responsibly manage student data they access.",
        ],
      },
      {
        title: "Acceptable use",
        paragraphs: [
          "No illegal, infringing, harassing, or abusive content.",
          "No attempts to hack, reverse engineer, or disrupt the service.",
          "No fraudulent logging or abuse of AI features.",
        ],
      },
      {
        title: "Health disclaimer",
        paragraphs: [
          "Calories and macros are estimates and may be inaccurate.",
          "Consult a registered dietitian or physician for medical dietary needs.",
          "You assume risk for dietary decisions based on app estimates.",
        ],
      },
      {
        title: "Coach–student relationship",
        paragraphs: [
          "Linked coaches may view relevant meal and body data.",
          "Coaching relationships are between users; the platform provides tools only.",
        ],
      },
      {
        title: "Intellectual property",
        paragraphs: [
          "App UI, branding, and software belong to the platform or licensors.",
          "You retain ownership of uploaded content but grant us license to host and process it.",
        ],
      },
      {
        title: "Changes & termination",
        paragraphs: [
          "We may update or discontinue features with reasonable notice.",
          "You may delete your account at any time.",
        ],
      },
      {
        title: "Limitation of liability",
        paragraphs: [
          "To the extent permitted by law, we are not liable for indirect loss, data errors, or outages.",
          "Features are provided as-is where applicable.",
        ],
      },
      {
        title: "Governing law",
        paragraphs: [
          "These terms are governed by the laws of Hong Kong SAR (adjust per your entity).",
          "Contact us first to resolve disputes.",
        ],
      },
    ],
  };
}
