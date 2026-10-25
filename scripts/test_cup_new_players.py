import json
import unittest
from pathlib import Path


class NewCupPlayersTests(unittest.TestCase):
    def test_actual_clubs_stay_separate_from_national_teams(self):
        data = json.loads(Path(__file__).with_name("sofascore-cup-new-players.json").read_text())
        for player in data["players"]:
            if player["team_id"]:
                self.assertNotEqual(player["team_id"], player["national_team_id"])
        assal = next(p for p in data["players"] if p["source_id"] == 1140803)
        self.assertEqual(assal["team_id"], "d54fe0d8-0edd-4c13-bb60-b5fe69a64078")

    def test_existing_qatar_players_are_reused(self):
        data = json.loads(Path(__file__).with_name("sofascore-cup-new-players.json").read_text())
        boudiaf = next(p for p in data["players"] if p["source_id"] == 303826)
        self.assertEqual(boudiaf["id"], "713115fd-e291-4f52-a7ae-5a6cfc461041")
        self.assertTrue(boudiaf["existing"])


if __name__ == "__main__":
    unittest.main()