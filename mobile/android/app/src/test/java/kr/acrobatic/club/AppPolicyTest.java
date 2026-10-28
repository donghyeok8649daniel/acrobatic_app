package kr.acrobatic.club;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.*;
public class AppPolicyTest {
    @Test public void navigationRestrictsTeamOrigin(){assertTrue(AppPolicy.isTeamUrl(AppPolicy.APP_URL+"?event=one"));assertFalse(AppPolicy.isTeamUrl("http://acrobatic-clubmanagement.acrobatic-kaist.workers.dev/"));assertFalse(AppPolicy.isTeamUrl("https://acrobatic-clubmanagement.acrobatic-kaist.workers.dev.evil.test/"));assertFalse(AppPolicy.isTeamUrl("https://user@acrobatic-clubmanagement.acrobatic-kaist.workers.dev/"));assertFalse(AppPolicy.isExternalUrl("javascript:alert(1)"));assertFalse(AppPolicy.isExternalUrl("file:///private/data"));}
    @Test public void reminderUsesKoreanMondayAndDoesNotRepeatPastTime(){assertEquals("2026-11-02T18:15+09:00[Asia/Seoul]",AppPolicy.nextReminder(Instant.parse("2026-10-28T00:00:00Z")).toString());assertEquals("2026-11-09T18:15+09:00[Asia/Seoul]",AppPolicy.nextReminder(Instant.parse("2026-11-02T09:15:00Z")).toString());}
}
