import ActivityKit
import Capacitor
import Foundation

/// Bridges ActivityKit to JavaScript so the web app can start, update and end
/// the Lock Screen / Dynamic Island live score.
///
/// Requires MatchAttributes.swift to be a member of this target as well as the
/// widget extension. Live Activities need iOS 16.1+; on older systems every
/// method rejects rather than crashing.
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    /// Live activities in flight, keyed by matchId so update/end can find them.
    private var activities: [String: Any] = [:]

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1 or later")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in Settings")
            return
        }
        guard let matchId = call.getString("matchId"),
              let homeTeam = call.getString("homeTeam"),
              let awayTeam = call.getString("awayTeam") else {
            call.reject("matchId, homeTeam and awayTeam are required")
            return
        }

        let attributes = MatchAttributes(
            matchId: matchId,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeShort: call.getString("homeShort") ?? String(homeTeam.prefix(3)).uppercased(),
            awayShort: call.getString("awayShort") ?? String(awayTeam.prefix(3)).uppercased()
        )
        let state = MatchAttributes.ContentState(
            homeScore: call.getInt("homeScore") ?? 0,
            awayScore: call.getInt("awayScore") ?? 0,
            minute: call.getString("minute") ?? "0'",
            status: call.getString("status") ?? "live"
        )

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: nil),
                // Yields a token the server can use to push updates while the
                // app is not running.
                pushType: .token
            )
            activities[matchId] = activity
            call.resolve(["id": activity.id])
        } catch {
            call.reject("Could not start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1 or later")
            return
        }
        guard let matchId = call.getString("matchId"),
              let activity = activities[matchId] as? Activity<MatchAttributes> else {
            call.reject("No Live Activity running for that match")
            return
        }

        let state = MatchAttributes.ContentState(
            homeScore: call.getInt("homeScore") ?? 0,
            awayScore: call.getInt("awayScore") ?? 0,
            minute: call.getString("minute") ?? "",
            status: call.getString("status") ?? "live"
        )

        Task {
            await activity.update(.init(state: state, staleDate: nil))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1 or later")
            return
        }
        guard let matchId = call.getString("matchId"),
              let activity = activities[matchId] as? Activity<MatchAttributes> else {
            call.resolve() // Already gone — nothing to do.
            return
        }

        Task {
            // Leave the full-time score on the Lock Screen briefly rather than
            // yanking it away the instant the match ends.
            await activity.end(activity.content, dismissalPolicy: .after(.now.addingTimeInterval(120)))
            activities.removeValue(forKey: matchId)
            call.resolve()
        }
    }
}
