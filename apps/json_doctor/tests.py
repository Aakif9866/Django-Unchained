from django.test import TestCase
from django.urls import reverse


class JsonDoctorTests(TestCase):
    def test_page_loads_for_guest(self):
        self.assertContains(self.client.get(reverse("json_doctor:index")), "json-core.js")
