from django import forms

from .models import Note


class NoteForm(forms.ModelForm):
    # strip=False: autosave fires mid-typing, so a trailing space must survive the round trip.
    title = forms.CharField(required=False, max_length=200, strip=False)
    body = forms.CharField(required=False, max_length=100_000, strip=False)

    class Meta:
        model = Note
        fields = ["title", "body", "pinned"]
