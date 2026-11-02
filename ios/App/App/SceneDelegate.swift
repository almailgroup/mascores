import UIKit
import Capacitor
import Photos
import AuthenticationServices
import WebKit

// Named after its JS name so Capacitor can also load it on demand
// (NSClassFromString("PhotoLibrary")) even if registration was skipped.
@objc(PhotoLibrary)
public class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryPlugin"
    public let jsName = "PhotoLibrary"
    public let pluginMethods = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]

    @objc func save(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64),
              UIImage(data: data) != nil else {
            call.reject("Could not read image")
            return
        }
        let write = {
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, data: data, options: nil)
            }) { success, error in
                DispatchQueue.main.async {
                    if success { call.resolve() }
                    else { call.reject(error?.localizedDescription ?? "Could not save photo") }
                }
            }
        }
        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        if status == .authorized || status == .limited { write(); return }
        if status == .denied || status == .restricted {
            call.reject("Allow MA Scores to add photos in iPhone Settings, then try again.")
            return
        }
        DispatchQueue.main.async {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { newStatus in
                if newStatus == .authorized || newStatus == .limited { write() }
                else {
                    DispatchQueue.main.async {
                        call.reject("Allow MA Scores to add photos in iPhone Settings, then try again.")
                    }
                }
            }
        }
    }
}

// Google / Apple sign-in in Apple's own compact sign-in sheet
// (ASWebAuthenticationSession): it has a Cancel button, fits the screen, and
// hands the return link straight back to the app. Lives in the app target so
// it never depends on an extra package being linked.
@objc(AuthSheet)
public class AuthSheetPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "AuthSheetPlugin"
    public let jsName = "AuthSheet"
    public let pluginMethods = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]
    private var session: ASWebAuthenticationSession?

    @objc func open(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              let scheme = call.getString("callbackScheme") else {
            call.reject("Missing sign-in link")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                    return
                }
                if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                    call.reject("Sign in was cancelled", "CANCELLED")
                    return
                }
                call.reject(error?.localizedDescription ?? "Sign-in failed")
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("Could not open sign-in")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

class MASBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhotoLibraryPlugin())
        bridge?.registerPluginInstance(AuthSheetPlugin())
        // Remove the web-only keyboard form assistant bar (arrows + Done).
        FormAssistantBarHider.start(over: webView)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // The Main storyboard already creates the app's screen; only build one
        // here if it didn't, so the app never runs two copies side by side.
        if window == nil || !(window?.rootViewController is MASBridgeViewController) {
            window = UIWindow(windowScene: windowScene)
            window?.rootViewController = MASBridgeViewController()
        }
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // In case WebKit rebuilt the web view's content view while the app was
    // away, try again on every activation. It is a no-op once applied.
    func sceneDidBecomeActive(_ scene: UIScene) {
        if let bridge = window?.rootViewController as? MASBridgeViewController {
            FormAssistantBarHider.start(over: bridge.webView)
        }
    }
}

// iOS shows a form assistant bar (up/down arrows and a Done button) above the
// keyboard whenever a text field inside the web view is focused. WKWebView has
// no public API to remove it, so the private content view's class is swapped
// for a runtime subclass whose `inputAccessoryView` is nil — the same
// technique Capacitor itself used for its old "hide form accessory bar"
// setting. It only runs inside the iPhone app; Safari and the website keep
// the system behaviour.
final class FormAssistantBarHider {
    private static var helperClass: AnyClass?
    private static var attempts = 0

    static func start(over webView: WKWebView?) {
        guard let webView, !hasSwap(webView) else { return }
        if apply(webView) { return }
        // The content view is created a moment after the web view itself;
        // retry briefly instead of giving up after the first look.
        attempts += 1
        guard attempts < 60 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { start(over: webView) }
    }

    /// True once a content view already carries the replacement class.
    private static func hasSwap(_ root: UIView) -> Bool {
        contentViews(in: root).contains { String(describing: type(of: $0)).hasSuffix("_NoFormBar") }
    }

    private static func contentViews(in root: UIView) -> [UIView] {
        var found: [UIView] = []
        for child in root.subviews {
            let name = String(describing: type(of: child))
            if name.hasPrefix("WKContent") { found.append(child) }
            found.append(contentsOf: contentViews(in: child))
        }
        return found
    }

    private static func apply(_ webView: WKWebView) -> Bool {
        for view in contentViews(in: webView) {
            let baseClass = type(of: view).classForCoder
            let newName = String(describing: baseClass) + "_NoFormBar"
            let targetClass: AnyClass
            if let existing = NSClassFromString(newName) {
                targetClass = existing
            } else {
                guard let superclass = baseClass.superclass,
                      let newClass = objc_allocateClassPair(superclass, newName, 0) else { continue }
                let selector = sel_registerName("inputAccessoryView")
                let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
                let encoding = class_getInstanceMethod(baseClass, selector)
                    .map { String(cString: method_getTypeEncoding($0)) } ?? "@16@0:8"
                class_addMethod(newClass, selector, imp_implementationWithBlock(block), encoding)
                objc_registerClassPair(newClass)
                helperClass = newClass
                targetClass = newClass
            }
            object_setClass(view, targetClass)
            return true
        }
        return false
    }
}
