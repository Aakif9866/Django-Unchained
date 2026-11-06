from django import forms

from .models import Title


class TitleForm(forms.ModelForm):
    rating = forms.IntegerField(required=False, min_value=1, max_value=10)

    class Meta:
        model = Title
        fields = ["name", "kind", "genre", "language", "rating", "watched", "favourite"]

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user

    def clean(self):
        data = super().clean()
        duplicates = Title.objects.filter(user=self.user, name__iexact=data.get("name", ""), kind=data.get("kind"))
        if self.instance.pk:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise forms.ValidationError("That's already on your list.")
        return data
