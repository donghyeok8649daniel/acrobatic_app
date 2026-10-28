declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TEAM_LOGIN_ALIASES?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    AUTH_PEPPER?: string;
    SHEET_SYNC_TOKEN?: string;
    SHEET_SYNC_CONFIG?: string;
    KAKAO_BRIDGE_TOKEN?: string;
    KAKAO_BRIDGE_TEAM_ID?: string;
    KAKAO_ROOM_ID?: string;
  }
}
