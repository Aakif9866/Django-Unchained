from django import forms

from .models import MazeRun

# Square mazes, start and finish in opposite corners. Keep in sync with app.js.
MAZE_SIZE = {"easy": 12, "medium": 20, "hard": 30}
MIN_MS_PER_MOVE = 15


class RunForm(forms.Form):
    """Runs are played in the browser, so this rejects the impossible; it can't prove honesty."""

    difficulty = forms.ChoiceField(choices=MazeRun.Difficulty.choices)
    time_ms = forms.IntegerField(min_value=1, max_value=3_600_000)
    moves = forms.IntegerField(min_value=1, max_value=100_000)

    def clean(self):
        data = super().clean()
        if self.errors:
            return data
        size = MAZE_SIZE[data["difficulty"]]
        if data["moves"] < 2 * (size - 1):
            raise forms.ValidationError("That's fewer moves than the corner-to-corner distance.")
        if data["time_ms"] < data["moves"] * MIN_MS_PER_MOVE:
            raise forms.ValidationError("That run was impossibly fast.")
        return data
