import ActivityKit
import Foundation

/// Describes a live match shown on the Lock Screen and in the Dynamic Island.
///
/// This file must be a member of BOTH targets — the app (which starts and ends
/// activities) and the widget extension (which renders them). If it belongs to
/// only one, the activity silently never appears.
struct MatchAttributes: ActivityAttributes {
    /// The part that changes as the match unfolds; pushed from the server.
    public struct ContentState: Codable, Hashable {
        var homeScore: Int
        var awayScore: Int
        /// Display clock, e.g. "67'" or "HT". A string so stoppage time ("45+2'") works.
        var minute: String
        /// "live" | "ht" | "ft" — drives the colour of the status pill.
        var status: String
    }

    var matchId: String
    var homeTeam: String
    var awayTeam: String
    /// Short codes such as "ARS"/"CHE"; the Dynamic Island is too narrow for full names.
    var homeShort: String
    var awayShort: String
}
