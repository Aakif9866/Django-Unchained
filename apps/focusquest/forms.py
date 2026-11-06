from django import forms

from .models import FocusSession
from .services import MAX_CUSTOM_MINUTES


class StartForm(forms.Form):
    mode = forms.ChoiceField(choices=FocusSession.Mode.choices)
    minutes = forms.IntegerField(required=False, min_value=1, max_value=MAX_CUSTOM_MINUTES)

    def clean(self):
        data = super().clean()
        if data.get("mode") == FocusSession.Mode.CUSTOM and not data.get("minutes") and "minutes" not in self.errors:
            self.add_error("minutes", "Choose how many minutes to focus for.")
        return data
