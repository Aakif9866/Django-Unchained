from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView, PasswordChangeView
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.http import url_has_allowed_host_and_scheme

from core.ratelimit import allow, client_ip

from .forms import LoginForm, ProfileForm, RegisterForm, StyledPasswordChangeForm

LOGIN_ATTEMPTS_PER_MINUTE = 10


class ThrottledLoginView(LoginView):
    template_name = "accounts/login.html"
    authentication_form = LoginForm
    redirect_authenticated_user = True

    def post(self, request, *args, **kwargs):
        if not allow(f"login:{client_ip(request)}", LOGIN_ATTEMPTS_PER_MINUTE, 60):
            messages.error(request, "Too many sign-in attempts. Try again in a minute.")
            return self.render_to_response(self.get_context_data(form=self.get_form_class()(request)), status=429)
        return super().post(request, *args, **kwargs)


def register(request):
    if request.user.is_authenticated:
        return redirect("core:dashboard")
    next_url = request.POST.get("next") or request.GET.get("next", "")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        login(request, form.save())
        messages.success(request, "Welcome to SIDEQUEST.")
        if url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
            return redirect(next_url)
        return redirect("core:dashboard")
    return render(request, "accounts/register.html", {"form": form, "next": next_url})


@login_required
def profile(request):
    form = ProfileForm(request.POST or None, instance=request.user)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Profile updated.")
        return redirect("accounts:profile")
    return render(request, "accounts/profile.html", {"form": form})


class StyledPasswordChangeView(PasswordChangeView):
    template_name = "accounts/password_change.html"
    form_class = StyledPasswordChangeForm
    success_url = reverse_lazy("accounts:profile")

    def form_valid(self, form):
        messages.success(self.request, "Password changed.")
        return super().form_valid(form)
