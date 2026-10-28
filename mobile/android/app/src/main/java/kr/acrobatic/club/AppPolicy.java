package kr.acrobatic.club;

import java.net.URI;
import java.time.*;
import java.time.temporal.TemporalAdjusters;

public final class AppPolicy {
    public static final String APP_URL = "https://acrobatic-clubmanagement.acrobatic-kaist.workers.dev/";
    public static final String UPDATES = "https://github.com/donghyeok8649daniel/acrobatic_app/releases/latest";
    public static boolean isTeamUrl(String value) {
        try { URI u = URI.create(value); return "https".equals(u.getScheme()) && "acrobatic-clubmanagement.acrobatic-kaist.workers.dev".equals(u.getHost()) && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443); }
        catch (Exception e) { return false; }
    }
    public static boolean isExternalUrl(String value) {
        try { URI u=URI.create(value); return "https".equals(u.getScheme()) && u.getHost()!=null && u.getUserInfo()==null; } catch(Exception e) { return false; }
    }
    public static ZonedDateTime nextReminder(Instant now) {
        ZonedDateTime local=now.atZone(ZoneId.of("Asia/Seoul"));
        ZonedDateTime target=local.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY)).withHour(18).withMinute(15).withSecond(0).withNano(0);
        return target.isAfter(local) ? target : target.plusWeeks(1);
    }
    private AppPolicy() {}
}
