import re

from django import forms

HEX_COLOR = re.compile(r"^#[0-9a-f]{6}$")
MIN_COLORS = 2
MAX_COLORS = 10


class PaletteForm(forms.Form):
    name = forms.CharField(max_length=60)
    colors = forms.JSONField()

    def clean_colors(self):
        colors = self.cleaned_data["colors"]
        if not isinstance(colors, list) or not MIN_COLORS <= len(colors) <= MAX_COLORS:
            raise forms.ValidationError(f"A palette needs {MIN_COLORS} to {MAX_COLORS} colors.")
        normalized = []
        for color in colors:
            if not isinstance(color, str) or not HEX_COLOR.match(color.lower()):
                raise forms.ValidationError("Colors must be six-digit hex values like #2dd4bf.")
            normalized.append(color.lower())
        return normalized
