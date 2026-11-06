from django.shortcuts import render


def index(request):
    """Everything runs in the browser, so pasted documents never leave the user's machine."""
    return render(request, "json_doctor/index.html")
