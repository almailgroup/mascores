import unittest
from emir_cup import audit, fixture, SEASON, TEAMS


class EmirCupTests(unittest.TestCase):
    def test_interrupted_season_is_retained(self):
        self.assertEqual(SEASON, "2025/2026")

    def test_both_qualifying_games_are_present(self):
        rows = audit()["fixtures"][:2]
        self.assertEqual([r["round"] for r in rows], ["Qualification round 1", "Qualification round 2"])
        self.assertEqual([(r["home_score"], r["away_score"]) for r in rows], [(2, 1), (5, 1)])

    def test_unknown_times_never_become_real_kickoffs(self):
        self.assertIsNone(audit()["fixtures"][10]["kickoff_at"])
        self.assertEqual(audit()["fixtures"][5]["kickoff_at"], "2026-02-13T16:45:00Z")
        self.assertEqual(audit()["fixtures"][1]["kickoff_at"], "2026-01-31T13:35:00Z")
        upcoming = [r for r in audit()["fixtures"] if r["status"] == "scheduled"]
        self.assertEqual([r["kickoff_date"] for r in upcoming], ["2026-11-25", "2026-11-26", "2026-11-26"])
        self.assertTrue(all(r["home_score"] is None and r["away_score"] is None for r in upcoming))

    def test_khaitan_shootout_winner_is_not_reversed(self):
        row = next(r for r in audit()["fixtures"] if r["status"] == "pen")
        self.assertEqual(row["away_team_id"], TEAMS["Khaitan"])
        self.assertEqual((row["home_score"], row["away_score"], row["home_pen"], row["away_pen"]), (1, 1, 1, 3))

    def test_future_scores_are_rejected(self):
        with self.assertRaises(ValueError):
            fixture("Quarter-finals", 4, "2026-11-26", "Arabi", "Khaitan", (2, 0), "scheduled")

    def test_unannounced_semifinal_assignment_and_final_date_remain_unknown(self):
        self.assertTrue(all(r["kickoff_date"] is None for r in audit()["unresolved_bracket"]))
        self.assertEqual(audit()["unresolved_bracket"][0]["home_team_id"], TEAMS["Kuwait"])


if __name__ == "__main__":
    unittest.main()