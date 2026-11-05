import UIKit
import Capacitor
import Photos
import AuthenticationServices
import ObjectiveC
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

// Real iOS tab bar (Liquid Glass on iOS 26, including hold-and-swipe between
// tabs). The website still draws its own bar; the app asks this plugin to show
// the system one on primary pages and hides it everywhere else.
final class PassthroughView: UIView {
    weak var bar: UIView?
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let bar, !isHidden else { return nil }
        let p = convert(point, to: bar)
        return bar.point(inside: p, with: event) ? bar.hitTest(p, with: event) : nil
    }
}

@objc(NativeTabBar)
public class NativeTabBarPlugin: CAPPlugin, CAPBridgedPlugin, UITabBarControllerDelegate {
    public let identifier = "NativeTabBarPlugin"
    public let jsName = "NativeTabBar"
    public let pluginMethods = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]
    private var tbc: UITabBarController?
    private var container: PassthroughView?
    private var signature = ""

    private func setup(in host: UIViewController) -> (UITabBarController, PassthroughView) {
        if let tbc, let container { return (tbc, container) }
        let wrap = PassthroughView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        wrap.backgroundColor = .clear
        host.view.addSubview(wrap)
        NSLayoutConstraint.activate([
            wrap.leadingAnchor.constraint(equalTo: host.view.leadingAnchor),
            wrap.trailingAnchor.constraint(equalTo: host.view.trailingAnchor),
            wrap.bottomAnchor.constraint(equalTo: host.view.bottomAnchor),
            wrap.topAnchor.constraint(equalTo: host.view.safeAreaLayoutGuide.bottomAnchor, constant: -110),
        ])
        let controller = UITabBarController()
        controller.delegate = self
        host.addChild(controller)
        controller.view.backgroundColor = .clear
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(controller.view)
        NSLayoutConstraint.activate([
            controller.view.leadingAnchor.constraint(equalTo: wrap.leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: wrap.trailingAnchor),
            controller.view.topAnchor.constraint(equalTo: wrap.topAnchor),
            controller.view.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
        ])
        controller.didMove(toParent: host)
        wrap.bar = controller.tabBar
        tbc = controller; container = wrap
        return (controller, wrap)
    }

    @objc func show(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let selected = call.getInt("selected") ?? 0
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else { call.reject("No screen"); return }
            let (controller, wrap) = self.setup(in: host)
            host.overrideUserInterfaceStyle = dark ? .dark : .light
            let sig = items.map { "\($0["title"] as? String ?? "")|\($0["icon"] as? String ?? "")" }.joined(separator: ",")
            if sig != self.signature {
                self.signature = sig
                controller.viewControllers = items.map { item in
                    let vc = UIViewController()
                    vc.view.backgroundColor = .clear
                    vc.view.isUserInteractionEnabled = false
                    let icon = item["icon"] as? String ?? "circle"
                    vc.tabBarItem = UITabBarItem(title: item["title"] as? String, image: UIImage(systemName: icon), selectedImage: UIImage(systemName: icon))
                    return vc
                }
            }
            if selected >= 0 && selected < (controller.viewControllers?.count ?? 0) { controller.selectedIndex = selected }
            wrap.isHidden = false
            host.view.bringSubviewToFront(wrap)
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.container?.isHidden = true; call.resolve() }
    }

    public func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
        let index = tabBarController.viewControllers?.firstIndex(of: viewController) ?? 0
        notifyListeners("select", data: ["index": index, "reselect": index == tabBarController.selectedIndex])
        return true
    }
}

class MASBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhotoLibraryPlugin())
        bridge?.registerPluginInstance(AuthSheetPlugin())
        bridge?.registerPluginInstance(NativeTabBarPlugin())
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
            let baseClass = type(of: view)
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
