import unittest
from sportscorner_youth import normalize_fixture, PARENTS


class YouthImportTests(unittest.TestCase):
    def fixture(self, **changes):
        row = dict(id=1114, seasonName="2026/2027", matchday=1, homeTeamName="كاظمة", awayTeamName="السالمية", matchDate="2026-09-01T15:40:00Z", status="Finished", homeScore=2, awayScore=1, venueName="النصر ٢")
        row.update(changes)
        return row

    def test_kuwait_u17_links_to_existing_senior_identity(self):
        row = normalize_fixture(self.fixture(homeTeamName="الكويت"), 17)
        self.assertEqual(row["home_parent"], "539cc6fb-d79a-449b-be23-1271355bd727")
        self.assertEqual(row["age"], 17)

    def test_verified_score_is_not_reversed(self):
        row = normalize_fixture(self.fixture(), 17)
        self.assertEqual((row["home_score"], row["away_score"]), (2, 1))

    def test_unconfirmed_time_is_date_only(self):
        row = normalize_fixture(self.fixture(status="Scheduled", matchDate="2026-10-28T09:00:00Z", kickoffTimeUnknown=True), 19)
        self.assertIsNone(row["kickoff_at"])
        self.assertEqual(row["kickoff_date"], "2026-10-28")
        self.assertIsNone(row["home_score"])

    def test_missing_finished_score_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_fixture(self.fixture(homeScore=None), 17)

    def test_youth_ground_is_not_senior_stadium(self):
        row = normalize_fixture(self.fixture(), 17)
        self.assertEqual(row["venue"], "Al Nasr Ground 2")
        self.assertIsNone(row["venue_id"])


if __name__ == "__main__":
    unittest.main()