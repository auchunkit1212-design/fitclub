/** 從 URL query 讀取教練邀請碼（?invite= 或 ?code=） */
export function readInviteCodeFromSearch(search: string): string {
  const query = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(query);
  return (params.get("invite") || params.get("code") || "").trim();
}

export function readInviteCodeFromWindow(): string {
  if (typeof window === "undefined") return "";
  return readInviteCodeFromSearch(window.location.search);
}

export function hasInviteInUrl(): boolean {
  return Boolean(readInviteCodeFromWindow());
}
