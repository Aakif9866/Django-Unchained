import re

from django import forms

from .safe_http import ALLOWED_METHODS, MAX_BODY_BYTES

MAX_PAIRS = 50
MAX_PAIR_LENGTH = 4096
HEADER_NAME = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
# Set by the HTTP client itself. Letting users set these would allow request smuggling and host spoofing.
FORBIDDEN_HEADERS = {
    "host", "content-length", "transfer-encoding", "connection", "upgrade", "te", "trailer",
    "keep-alive", "accept-encoding", "proxy-authorization", "proxy-connection",
}


def _clean_pairs(value, label):
    if value in (None, ""):
        return []
    if not isinstance(value, list) or len(value) > MAX_PAIRS:
        raise forms.ValidationError(f"{label} must be a list of at most {MAX_PAIRS} pairs.")
    pairs = []
    for pair in value:
        if not (isinstance(pair, list) and len(pair) == 2 and all(isinstance(part, str) for part in pair)):
            raise forms.ValidationError(f"Each entry in {label} must be a [name, value] pair.")
        if any(len(part) > MAX_PAIR_LENGTH for part in pair):
            raise forms.ValidationError(f"An entry in {label} is too long.")
        pairs.append((pair[0], pair[1]))
    return pairs


def _clean_headers(value):
    headers = _clean_pairs(value, "Headers")
    for name, header_value in headers:
        if not HEADER_NAME.match(name):
            raise forms.ValidationError(f"'{name[:40]}' isn't a valid header name.")
        if name.lower() in FORBIDDEN_HEADERS:
            raise forms.ValidationError(f"The {name} header is set automatically and can't be changed.")
        if any(c in header_value for c in "\r\n\0"):
            raise forms.ValidationError(f"The value of {name} contains illegal line breaks.")
    return headers


class RequestFieldsMixin(forms.Form):
    method = forms.ChoiceField(choices=[(m, m) for m in ALLOWED_METHODS])
    url = forms.CharField(max_length=2048)
    params = forms.JSONField(required=False)
    headers = forms.JSONField(required=False)
    body = forms.CharField(required=False, strip=False, max_length=MAX_BODY_BYTES)

    def clean_params(self):
        return _clean_pairs(self.cleaned_data.get("params"), "Query parameters")

    def clean_headers(self):
        return _clean_headers(self.cleaned_data.get("headers"))


class SendForm(RequestFieldsMixin):
    pass


class SaveForm(RequestFieldsMixin):
    name = forms.CharField(max_length=80)
