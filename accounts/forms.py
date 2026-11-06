from django import forms
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm, UserCreationForm

from .models import User


class BootstrapMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.setdefault("class", "form-control")


class RegisterForm(BootstrapMixin, UserCreationForm):
    class Meta:
        model = User
        fields = ["username", "email"]


class LoginForm(BootstrapMixin, AuthenticationForm):
    pass


class StyledPasswordChangeForm(BootstrapMixin, PasswordChangeForm):
    pass


class ProfileForm(BootstrapMixin, forms.ModelForm):
    class Meta:
        model = User
        fields = ["display_name", "email", "bio"]
