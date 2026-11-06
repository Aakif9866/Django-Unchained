from django import forms

from .models import SnakeScore

# Keep in sync with app.js. The best single pickup is a gold apple during double points.
POINTS_MULTIPLIER = {"easy": 1, "normal": 2, "hard": 3}
MAX_POINTS_PER_ITEM = 100
MIN_SECONDS_PER_ITEM = 0.05  # Faster than the fastest tick the game can run at.


class ScoreForm(forms.Form):
    """Scores come from browser code, so this can only reject the impossible, not prove honesty."""

    difficulty = forms.ChoiceField(choices=SnakeScore.Difficulty.choices)
    score = forms.IntegerField(min_value=0, max_value=1_000_000)
    items_collected = forms.IntegerField(min_value=0, max_value=10_000)
    duration_seconds = forms.FloatField(min_value=0.1, max_value=86_400)

    def clean(self):
        data = super().clean()
        if self.errors:
            return data
        ceiling = data["items_collected"] * MAX_POINTS_PER_ITEM * POINTS_MULTIPLIER[data["difficulty"]]
        if data["score"] > ceiling:
            raise forms.ValidationError("That score isn't possible with the items collected.")
        if data["items_collected"] * MIN_SECONDS_PER_ITEM > data["duration_seconds"]:
            raise forms.ValidationError("That game was impossibly fast.")
        return data
