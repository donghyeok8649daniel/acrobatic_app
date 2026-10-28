import XCTest
final class LaunchTests: XCTestCase {
    func testAppLaunchesAndOpensOfflineGuide() {
        let app = XCUIApplication(); app.launch()
        let manual = app.buttons["offline-manual"]
        XCTAssertTrue(manual.waitForExistence(timeout: 20))
        manual.tap()
        XCTAssertTrue(app.webViews.staticTexts["ACROBATIC / TRAINING"].waitForExistence(timeout: 15))
    }
}
