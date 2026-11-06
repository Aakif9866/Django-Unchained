import json

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from . import services

SAMPLE = b"""id,name,score,joined,active
001,Ada,90.5,2024-01-02,True
002,Grace,,2024-02-03,False
002,Grace,,2024-02-03,False
003,  Alan ,70,2024-03-04,True
004,=HYPERLINK("http://evil"),-5,2024-04-05,True
,,,,
"""


def upload(content=SAMPLE, name="data.csv"):
    return SimpleUploadedFile(name, content, content_type="text/csv")


class ProfileTests(TestCase):
    def setUp(self):
        self.result = services.profile(upload())
        self.columns = {c["name"]: c for c in self.result["columns"]}

    def test_counts(self):
        self.assertEqual(self.result["rows"], 6)
        self.assertEqual(self.result["column_count"], 5)
        self.assertEqual(self.result["duplicate_rows"], 1)
        self.assertEqual(self.columns["score"]["missing"], 3)
        self.assertEqual(self.result["rows_with_missing"], 3)

    def test_types(self):
        self.assertEqual(self.columns["id"]["type"], "integer")
        self.assertEqual(self.columns["name"]["type"], "text")
        self.assertEqual(self.columns["score"]["type"], "float")
        self.assertEqual(self.columns["joined"]["type"], "datetime")

    def test_numeric_summary(self):
        summary = self.columns["score"]["summary"]
        self.assertEqual(summary["min"], -5)
        self.assertEqual(summary["max"], 90.5)
        self.assertAlmostEqual(summary["mean"], 155.5 / 3, places=3)
        self.assertEqual(sum(self.columns["score"]["histogram"]["counts"]), 3)

    def test_output_is_strict_json(self):
        # json.dumps with allow_nan=False fails on the NaN that Pandas loves to produce.
        json.dumps(self.result, allow_nan=False)

    def test_infinity_and_all_missing_columns_are_safe(self):
        result = services.profile(upload(b"a,b\ninf,\n1,\n"))
        json.dumps(result, allow_nan=False)
        self.assertEqual({c["name"]: c["type"] for c in result["columns"]}["b"], "empty")


class ValidationTests(TestCase):
    def assert_rejected(self, file):
        with self.assertRaises(services.CsvError):
            services.profile(file)

    def test_rejects_bad_uploads(self):
        self.assert_rejected(upload(name="evil.exe"))
        self.assert_rejected(upload(name="data.csv.py"))
        self.assert_rejected(upload(b""))
        self.assert_rejected(upload(b"MZ\x00\x00binary"))
        self.assert_rejected(upload(b"\n\n"))
        self.assert_rejected(upload(b"a" * (services.MAX_FILE_BYTES + 1)))

    def test_rejects_malformed_rows(self):
        self.assert_rejected(upload(b"a,b\n1,2\n1,2,3,4\n"))

    def test_trailing_commas_do_not_shift_columns(self):
        result = services.profile(upload(b"a,b\n1,2,\n3,4,\n"))
        self.assertEqual(result["preview_headers"], ["a", "b"])
        self.assertEqual(result["preview"], [[1, 2], [3, 4]])

    def test_latin1_is_decoded(self):
        self.assertEqual(services.profile(upload("name\ncafé\n".encode("cp1252")))["rows"], 1)

    def test_row_limit(self):
        with self.settings():
            original = services.MAX_ROWS
            services.MAX_ROWS = 2
            try:
                self.assert_rejected(upload(b"a\n1\n2\n3\n"))
            finally:
                services.MAX_ROWS = original


class CleanTests(TestCase):
    OPTIONS = dict(drop_duplicates=False, drop_empty_rows=False, drop_rows_with_missing=False,
                   trim_whitespace=False, neutralize_formulas=False)

    def clean(self, **options):
        return services.clean(upload(), **{**self.OPTIONS, **options})

    def test_no_options_preserves_leading_zeros(self):
        text, before, after = self.clean()
        self.assertEqual((before, after), (6, 6))
        self.assertIn("001,Ada", text)

    def test_drop_duplicates_and_empty(self):
        _, _, after = self.clean(drop_duplicates=True, drop_empty_rows=True)
        self.assertEqual(after, 4)

    def test_trim(self):
        self.assertIn("003,Alan,", self.clean(trim_whitespace=True)[0])

    def test_formula_neutralized_but_negative_numbers_kept(self):
        text = self.clean(neutralize_formulas=True)[0]
        self.assertIn("'=HYPERLINK", text)
        self.assertIn(",-5,", text)


class EndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_guest_can_analyze(self):
        response = self.client.post(reverse("csv_detective:analyze"), {"file": upload()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rows"], 6)

    def test_clean_download(self):
        response = self.client.post(reverse("csv_detective:clean"), {"file": upload(name="my data!.csv"), "drop_duplicates": "on"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn('filename="my-data-cleaned.csv"', response["Content-Disposition"])
        self.assertEqual(response["X-Rows-After"], "5")

    def test_missing_file_and_bad_extension(self):
        self.assertEqual(self.client.post(reverse("csv_detective:analyze")).status_code, 400)
        self.assertEqual(self.client.post(reverse("csv_detective:analyze"), {"file": upload(name="x.txt")}).status_code, 400)

    def test_throttled(self):
        for _ in range(20):
            self.client.post(reverse("csv_detective:analyze"), {"file": upload()})
        self.assertEqual(self.client.post(reverse("csv_detective:analyze"), {"file": upload()}).status_code, 429)
