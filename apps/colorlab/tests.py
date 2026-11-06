from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import SavedPalette

User = get_user_model()


class PaletteApiTests(TestCase):
    def setUp(self):
        self.ada = User.objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("colorlab:palettes")

    def post(self, **data):
        return self.client.post(self.url, {"name": "Dusk", "colors": ["#112233", "#AABBCC"], **data}, content_type="application/json")

    def test_guest_can_open_page_but_not_save(self):
        self.assertEqual(self.client.get(reverse("colorlab:index")).status_code, 200)
        self.assertEqual(self.post().status_code, 401)

    def test_save_normalizes_hex(self):
        self.client.force_login(self.ada)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(SavedPalette.objects.get().colors, ["#112233", "#aabbcc"])

    def test_invalid_palettes_rejected(self):
        self.client.force_login(self.ada)
        bad = [["#112233"], ["#112233"] * 11, ["red", "#112233"], ["#123", "#112233"], "nope", [1, 2], ["#112233", "</script>"]]
        for colors in bad:
            self.assertEqual(self.post(colors=colors).status_code, 400, colors)
        self.assertEqual(self.post(name="").status_code, 400)

    def test_palettes_are_private(self):
        palette = SavedPalette.objects.create(user=self.ada, name="x", colors=["#000000", "#ffffff"])
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        self.assertEqual(self.client.get(self.url).json()["palettes"], [])
        self.assertEqual(self.client.delete(reverse("colorlab:delete_palette", args=[palette.pk])).status_code, 404)
        self.client.force_login(self.ada)
        self.assertEqual(self.client.delete(reverse("colorlab:delete_palette", args=[palette.pk])).status_code, 200)
        self.assertFalse(SavedPalette.objects.exists())
