from django import forms

from .models import SavedPattern

ALLOWED_FLAGS = set("dgimsuvy")


class PatternForm(forms.ModelForm):
    class Meta:
        model = SavedPattern
        fields = ["name", "pattern", "flags"]

    def clean_flags(self):
        flags = self.cleaned_data["flags"]
        if set(flags) - ALLOWED_FLAGS or len(set(flags)) != len(flags):
            raise forms.ValidationError("Flags must be unique and from: d g i m s u v y.")
        if "u" in flags and "v" in flags:
            raise forms.ValidationError("The u and v flags can't be combined.")
        return flags
