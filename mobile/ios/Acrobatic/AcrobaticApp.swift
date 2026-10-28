import SwiftUI
import WebKit
import UserNotifications

func text(_ ko: String, _ en: String) -> String { Locale.preferredLanguages.first?.hasPrefix("ko") == true ? ko : en }

@main
struct AcrobaticApp: App {
    @StateObject private var browser = TeamBrowser()
    @StateObject private var reminders = TrainingReminders()
    var body: some Scene {
        WindowGroup { ClubView(browser: browser, reminders: reminders).preferredColorScheme(.light) }
    }
}

struct ClubView: View {
    @ObservedObject var browser: TeamBrowser
    @ObservedObject var reminders: TrainingReminders
    @State private var guide = false
    @State private var settings = false
    var body: some View {
        NavigationStack {
            ZStack {
                BrowserView(webView: browser.webView)
                if browser.offline {
                    VStack(spacing: 24) {
                        Image(systemName: "wifi.slash").font(.largeTitle)
                        Text(text("연결이 끊겼어. 팀 기록은 서버에 보관돼 있어.", "Connection unavailable. Your team records remain on the server.")).multilineTextAlignment(.center)
                        Button(text("다시 연결", "Reconnect")) { browser.reload() }.buttonStyle(.borderedProminent)
                        Button(text("오프라인 훈련 가이드", "Offline training guide")) { guide = true }
                    }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.white)
                }
                if browser.loading { VStack { ProgressView().progressViewStyle(.linear); Spacer() }.allowsHitTesting(false) }
            }
            .navigationTitle("ACROBATIC")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { guide = true } label: { Image(systemName: "book.closed") }.accessibilityLabel(text("훈련 가이드", "Training guide")).accessibilityIdentifier("offline-manual")
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { settings = true } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel(text("앱 설정", "App settings"))
                }
            }
            .sheet(isPresented: $guide) {
                NavigationStack { OfflineGuide().navigationTitle(text("훈련 가이드", "Training guide")).navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .confirmationAction) { Button(text("닫기", "Close")) { guide = false } } } }
            }
            .sheet(isPresented: $settings) {
                NavigationStack {
                    List {
                        Section("Acrobatic 0.3.2") {
                            Button(text("팀 기록 새로고침", "Refresh team records")) { browser.reload(); settings = false }
                            Button(text("훈련 가이드", "Training guide")) { settings = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { guide = true } }
                            ShareLink(item: AppPolicy.home) { Label(text("동아리 앱 공유", "Share club app"), systemImage: "square.and.arrow.up") }
                        }
                        Section(text("개인 훈련 알림", "Personal training reminder")) {
                            Button(reminders.enabled ? text("개인 알림 끄기", "Disable personal reminder") : text("매주 월요일 18:15 알림 켜기", "Enable Monday 18:15 reminder")) { reminders.enabled ? reminders.disable() : reminders.enable() }
                            Text(text("한국시간 기준으로 매주 반복돼. 휴강 여부는 동아리 공지를 확인해.", "Repeats weekly in Korea time. Check club announcements for cancellations.")).font(.footnote).foregroundStyle(.secondary)
                            Text(text("새 공지 푸시는 별도 연결이 필요해.", "Push notifications for new announcements still require setup.")).font(.footnote).foregroundStyle(.secondary)
                            if !reminders.message.isEmpty { Text(reminders.message).font(.footnote) }
                        }
                    }.navigationTitle(text("앱 설정", "App settings")).toolbar { ToolbarItem(placement: .confirmationAction) { Button(text("닫기", "Close")) { settings = false } } }
                }
            }
            .confirmationDialog(text("외부 링크를 열까?", "Open external link?"), isPresented: Binding(get: { browser.external != nil }, set: { if !$0 { browser.external = nil } })) {
                if let url = browser.external { Button(text("열기", "Open")) { UIApplication.shared.open(url); browser.external = nil } }
            } message: { Text(browser.external?.host ?? "") }
        }.tint(Color(red: 0.14, green: 0.31, blue: 0.45))
    }
}

struct BrowserView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

struct OfflineGuide: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: config)
        if let url = Bundle.main.url(forResource: "manuals", withExtension: "html"), let html = try? String(contentsOf: url, encoding: .utf8) { view.loadHTMLString(html, baseURL: nil) }
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
