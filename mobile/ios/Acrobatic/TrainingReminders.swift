import Foundation
import UserNotifications
import Combine

final class TrainingReminders: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var enabled = UserDefaults.standard.bool(forKey: "personal-reminder")
    @Published var message = ""
    private let identifier = "personal-monday-training"
    override init() { super.init(); UNUserNotificationCenter.current().delegate = self }
    func enable() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { allowed, error in
            guard allowed else { DispatchQueue.main.async { self.message = text("기기 설정에서 알림을 허용해줘.", "Allow notifications in device settings.") }; return }
            let content = UNMutableNotificationContent()
            content.title = text("개인 훈련 알림", "Personal training reminder")
            content.body = text("월요일 정기훈련은 18:30부터야. 오늘 훈련공지는 앱에서 확인해.", "Monday training starts at 18:30. Check the app for today's announcement.")
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: AppPolicy.reminderComponents, repeats: true)
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: self.identifier, content: content, trigger: trigger)) { error in
                DispatchQueue.main.async { if error == nil { self.enabled = true; UserDefaults.standard.set(true, forKey: "personal-reminder"); self.message = text("개인 알림을 켰어.", "Personal reminder enabled.") } else { self.message = text("알림을 설정하지 못했어.", "Could not enable the reminder.") } }
            }
        }
    }
    func disable() { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier]); UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier]); enabled = false; UserDefaults.standard.set(false, forKey: "personal-reminder"); message = text("개인 알림을 껐어.", "Personal reminder disabled.") }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
}
