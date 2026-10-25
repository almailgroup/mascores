"""Validate the audited cup import without contacting a service."""
import json
import unittest
from pathlib import Path


class CupImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit = json.loads(Path(__file__).with_name("sofascore-cups-import.json").read_text())

    def test_existing_khaleeji_identity(self):
        matches = [m for m in self.audit["matches"] if m["competition_id"] == "246d74c1-2746-40bf-ad75-cdff6fb0fe0e"]
        self.assertEqual(len(matches), 15)

    def test_match_shirts_do_not_create_profiles(self):
        self.assertEqual(len(self.audit["lineups"]), 539)
        self.assertTrue(all(p["player_id"] and p["team_id"] for p in self.audit["lineups"]))

    def test_source_ratings_are_not_claimed(self):
        self.assertEqual(len(self.audit["ratings"]), 395)
        self.assertTrue(all("independent event-based estimates" in m["notes"] for m in self.audit["matches"]))


if __name__ == "__main__":
    unittest.main()