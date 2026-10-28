import Foundation
import WebKit
import UIKit
import Combine

final class TeamBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let webView: WKWebView
    @Published var offline = false
    @Published var loading = true
    @Published var external: URL?
    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "AcrobaticIOS/0.3.1"
        config.mediaTypesRequiringUserActionForPlayback = .all
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: AppPolicy.home))
    }
    func reload() { offline = false; if let url = webView.url, AppPolicy.isTeamURL(url) { webView.reload() } else { webView.load(URLRequest(url: AppPolicy.home)) } }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if AppPolicy.isTeamURL(url) {
            if action.targetFrame == nil { webView.load(action.request); decisionHandler(.cancel) } else { decisionHandler(.allow) }
            return
        }
        if action.targetFrame?.isMainFrame != false && AppPolicy.isExternalURL(url) { external = url }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { loading = true; offline = false }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    private func failed(_ error: Error) { if (error as NSError).code != NSURLErrorCancelled { loading = false; offline = true } }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reload() }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) { if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 500 { offline = true }; decisionHandler(.allow) }
    private func present(_ alert: UIAlertController) { var controller = webView.window?.rootViewController; while let next = controller?.presentedViewController { controller = next }; controller?.present(alert, animated: true) }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Acrobatic", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: text("확인", "OK"), style: .default) { _ in completionHandler() }); present(alert)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Acrobatic", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: text("취소", "Cancel"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: text("확인", "OK"), style: .default) { _ in completionHandler(true) }); present(alert)
    }
}
