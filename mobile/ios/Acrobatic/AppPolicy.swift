import Foundation

enum AppPolicy {
    static let home = URL(string: "https://acrobatic-clubmanagement.acrobatic-kaist.workers.dev/")!
    static func isTeamURL(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == home.host && url.user == nil && url.password == nil && (url.port == nil || url.port == 443)
    }
    static func isExternalURL(_ url: URL) -> Bool { url.scheme == "https" && url.host != nil && url.user == nil && url.password == nil }
    static var reminderComponents: DateComponents {
        var date = DateComponents()
        date.calendar = Calendar(identifier: .gregorian)
        date.timeZone = TimeZone(identifier: "Asia/Seoul")
        date.weekday = 2
        date.hour = 18
        date.minute = 15
        return date
    }
}
