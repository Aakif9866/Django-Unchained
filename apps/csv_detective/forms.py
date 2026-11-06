from django import forms


class CleanOptionsForm(forms.Form):
    drop_duplicates = forms.BooleanField(required=False)
    drop_empty_rows = forms.BooleanField(required=False)
    drop_rows_with_missing = forms.BooleanField(required=False)
    trim_whitespace = forms.BooleanField(required=False)
    neutralize_formulas = forms.BooleanField(required=False)
