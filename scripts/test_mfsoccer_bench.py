import unittest
from datetime import datetime, timezone
from mfsoccer_bench import displayed_bench


class BenchImportTests(unittest.TestCase):
    def setUp(self):
        self.source = {"squads": {"الكويت": [{"n": n, "s": i} for i, n in enumerate(["starter", "incoming", "outgoing", "reserve", "absent", "injured"], 1)]},
                       "lineups": [{"club": "الكويت", "r": 1, "comp": "الدوري", "p": "starter"}],
                       "subs": [{"club": "الكويت", "r": 1, "comp": "الدوري", "in": "incoming", "out": "outgoing"}]}
        self.match = {"round": 1, "comp": "الدوري", "date": "2026-08-25", "time": "18:45", "abs": [{"c": "الكويت", "p": "absent"}]}
        self.fantasy = {"players": {"list": [{"club": "KUW", "name": "injured", "status": "i"}]}}

    def test_starters_and_both_substitution_players_are_not_unused_reserves(self):
        names = [p["n"] for p in displayed_bench(self.source, self.match, "الكويت", self.fantasy, datetime(2026, 10, 24, tzinfo=timezone.utc))]
        self.assertEqual(names, ["reserve", "injured"])

    def test_current_injuries_only_apply_within_source_three_day_window(self):
        names = [p["n"] for p in displayed_bench(self.source, self.match, "الكويت", self.fantasy, datetime(2026, 8, 26, tzinfo=timezone.utc))]
        self.assertEqual(names, ["reserve"])

    def test_match_presence_overrides_fantasy_but_not_explicit_absence(self):
        self.match["pres"] = [{"c": "الكويت", "p": "injured"}, {"c": "الكويت", "p": "absent"}]
        names = [p["n"] for p in displayed_bench(self.source, self.match, "الكويت", self.fantasy, datetime(2026, 8, 26, tzinfo=timezone.utc))]
        self.assertEqual(names, ["reserve", "injured"])


if __name__ == "__main__":
    unittest.main()