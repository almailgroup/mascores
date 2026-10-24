import unittest
from sofascore_stats import parse_stats, reconcile


class SofascoreStatsTests(unittest.TestCase):
    def test_explicit_statistics(self):
        rows, rejected = parse_stats('Match overview\n\n59%\n\nBall possession\n\n41%\n\n5\n\nCorner kicks\n\n3\n\nAbout the match')
        self.assertEqual([(r['label'], r['home'], r['away']) for r in rows], [('Ball possession', '59%', '41%'), ('Corner kicks', '5', '3')])
        self.assertEqual(rejected, [])

    def test_invalid_source_values_are_not_imported(self):
        rows, rejected = parse_stats('Match overview\n\n0%\n\nBall possession\n\n0%\n\n194\n\nCorner kicks\n\n8\n\nAbout the match')
        self.assertEqual(rows, [])
        self.assertEqual(len(rejected), 2)

    def test_reverse_sides_keep_numbers_with_the_correct_team(self):
        source = '- # Tadhamon SC vs Al Kuwait SC live score\nPremier League, Round 6\n2 \\- 6\n\nFinished'
        fixture = dict(id='fixture', home='Kuwait SC', away='Al Tadamon SC', home_score=6, away_score=2, status='ft', round_number=6)
        self.assertEqual(reconcile(source, [fixture]), (fixture, True))

    def test_unfinished_or_conflicting_results_are_not_imported(self):
        source = '- # Tadhamon SC vs Al Kuwait SC live score\nPremier League, Round 6\n2 \\- 6\n\nFinished'
        fixture = dict(id='fixture', home='Al Tadamon SC', away='Kuwait SC', home_score=2, away_score=5, status='ft', round_number=6)
        self.assertIsNone(reconcile(source, [fixture]))
        fixture.update(home_score=2, away_score=6, status='scheduled')
        self.assertIsNone(reconcile(source, [fixture]))


if __name__ == '__main__':
    unittest.main()