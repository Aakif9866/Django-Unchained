from django import forms

from .models import TypingResult
from .services import DURATIONS, MAX_PLAUSIBLE_WPM, calculate_accuracy, calculate_wpm


class ResultForm(forms.Form):
    """Accepts raw counts only. WPM and accuracy are always derived here, never accepted."""

    mode = forms.ChoiceField(choices=TypingResult.Mode.choices)
    seconds = forms.TypedChoiceField(choices=[(d, d) for d in DURATIONS], coerce=int)
    correct_chars = forms.IntegerField(min_value=0, max_value=100_000)
    keystrokes = forms.IntegerField(min_value=1, max_value=100_000)
    errors = forms.IntegerField(min_value=0, max_value=100_000)

    def clean(self):
        data = super().clean()
        if self.errors:
            return data
        if data["errors"] > data["keystrokes"] or data["correct_chars"] > data["keystrokes"] - data["errors"]:
            raise forms.ValidationError("Those keystroke counts don't add up.")
        data["wpm"] = calculate_wpm(data["correct_chars"], data["seconds"])
        data["accuracy"] = calculate_accuracy(data["keystrokes"], data["errors"])
        if data["wpm"] > MAX_PLAUSIBLE_WPM:
            raise forms.ValidationError("That speed is beyond any recorded human typist.")
        return data
