import XCTest
@testable import Acrobatic

final class AppPolicyTests: XCTestCase {
    func testNavigationOrigin() {
        XCTAssertTrue(AppPolicy.isTeamURL(AppPolicy.home))
        for url in ["http://acrobatic-clubmanagement.acrobatic-kaist.workers.dev/", "https://user@acrobatic-clubmanagement.acrobatic-kaist.workers.dev/", "https://acrobatic-clubmanagement.acrobatic-kaist.workers.dev.evil.test/", "file:///private/data"] { XCTAssertFalse(AppPolicy.isTeamURL(URL(string: url)!)) }
        XCTAssertFalse(AppPolicy.isExternalURL(URL(string: "javascript:alert(1)")!))
    }
    func testReminderIsMondayInKoreaAndManualIsBundled() {
        let d = AppPolicy.reminderComponents
        XCTAssertEqual(d.weekday, 2); XCTAssertEqual(d.hour, 18); XCTAssertEqual(d.minute, 15); XCTAssertEqual(d.timeZone?.identifier, "Asia/Seoul")
        XCTAssertNotNil(Bundle.main.url(forResource: "manuals", withExtension: "html"))
    }
}
