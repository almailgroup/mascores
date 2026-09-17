import ActivityKit
import SwiftUI
import WidgetKit

// Brand palette, matching theme_color / background_color in manifest.webmanifest.
private extension Color {
    static let masNavy = Color(red: 10 / 255, green: 22 / 255, blue: 40 / 255)
    static let masBlue = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
}

private func statusTint(_ status: String) -> Color {
    switch status {
    case "live": return .masBlue
    case "ht": return .orange
    default: return .secondary
    }
}

private func statusLabel(_ state: MatchAttributes.ContentState) -> String {
    switch state.status {
    case "ht": return "HT"
    case "ft": return "FT"
    default: return state.minute
    }
}

/// The Lock Screen / Notification Centre presentation.
struct MatchLockScreenView: View {
    let context: ActivityViewContext<MatchAttributes>

    var body: some View {
        HStack(spacing: 12) {
            Text(context.attributes.homeTeam)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .trailing)

            VStack(spacing: 2) {
                Text("\(context.state.homeScore) – \(context.state.awayScore)")
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                Text(statusLabel(context.state))
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(statusTint(context.state.status))
            }

            Text(context.attributes.awayTeam)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .activityBackgroundTint(.masNavy)
        .activitySystemActionForegroundColor(.white)
    }
}

struct MatchLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MatchAttributes.self) { context in
            MatchLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.homeShort)
                        .font(.headline.weight(.bold))
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.awayShort)
                        .font(.headline.weight(.bold))
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text("\(context.state.homeScore) – \(context.state.awayScore)")
                            .font(.title3.weight(.bold))
                            .monospacedDigit()
                        Text(statusLabel(context.state))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(statusTint(context.state.status))
                    }
                }
            } compactLeading: {
                Text(context.attributes.homeShort).font(.caption2.weight(.bold))
            } compactTrailing: {
                Text("\(context.state.homeScore)–\(context.state.awayScore)")
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
            } minimal: {
                Text("\(context.state.homeScore)–\(context.state.awayScore)")
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
            }
            // Opens the match centre in the app when tapped.
            .widgetURL(URL(string: "mascores://match/\(context.attributes.matchId)"))
            .keylineTint(.masBlue)
        }
    }
}

/// Entry point for the widget extension target.
@main
struct MatchLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        MatchLiveActivity()
    }
}
