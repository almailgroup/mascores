import UIKit
import Capacitor
import Photos
import AuthenticationServices

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
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MASBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
