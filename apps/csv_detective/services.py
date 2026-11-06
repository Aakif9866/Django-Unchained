"""CSV profiling and cleaning with Pandas. Uploaded content is only ever parsed as data."""
import csv
import io
import math
from pathlib import Path

import numpy as np
import pandas as pd
from django.utils.text import slugify

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ROWS = 200_000
MAX_COLUMNS = 200
PREVIEW_ROWS = 50
HISTOGRAM_BINS = 12
TOP_VALUES = 8
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


class CsvError(Exception):
    """A problem with the upload, with a message that's safe to show the user."""


def _decode(uploaded):
    name = uploaded.name or ""
    if Path(name).suffix.lower() != ".csv":
        raise CsvError("Please upload a file with a .csv extension.")
    if uploaded.size == 0:
        raise CsvError("That file is empty.")
    if uploaded.size > MAX_FILE_BYTES:
        raise CsvError(f"Files are limited to {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    raw = uploaded.read()
    if b"\x00" in raw[:8192]:
        raise CsvError("That looks like a binary file, not a CSV.")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def _read(text, **options):
    try:
        # index_col=False: otherwise rows with a trailing comma silently shift every column left.
        frame = pd.read_csv(io.StringIO(text), nrows=MAX_ROWS + 1, index_col=False, **options)
    except pd.errors.EmptyDataError:
        raise CsvError("No columns found. Is the file empty?")
    except (pd.errors.ParserError, ValueError, csv.Error) as error:
        # Pandas parser messages name a line, not any server detail, and help users fix files.
        raise CsvError(f"Couldn't parse this as CSV: {str(error).strip()[:200]}")
    if len(frame) > MAX_ROWS:
        raise CsvError(f"Files are limited to {MAX_ROWS:,} rows.")
    if frame.shape[1] > MAX_COLUMNS:
        raise CsvError(f"Files are limited to {MAX_COLUMNS} columns.")
    frame.columns = [str(c) for c in frame.columns]
    return frame


def _finite(value, digits=4):
    """JSON has no NaN or Infinity, and numpy types don't serialize."""
    number = float(value)
    return round(number, digits) if math.isfinite(number) else None


def _column_type(series):
    if series.isna().all():
        return "empty"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_integer_dtype(series):
        return "integer"
    if pd.api.types.is_float_dtype(series):
        # Integers with gaps arrive as floats, so look past the missing values.
        present = series.dropna()
        whole = len(present) > 0 and np.isfinite(present).all() and (present == present.round()).all()
        return "integer" if whole else "float"
    sample = series.dropna().astype(str).head(500)
    if sample.str.contains(r"\d{1,4}[-/.:]\d{1,2}").mean() > 0.9:
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        if parsed.notna().mean() > 0.9:
            return "datetime"
    return "text"


def _numeric_summary(series):
    values = series.dropna().astype(float)
    values = values[np.isfinite(values)]
    if values.empty:
        return None, None
    counts, edges = np.histogram(values, bins=HISTOGRAM_BINS)
    summary = {
        "mean": _finite(values.mean()), "median": _finite(values.median()), "std": _finite(values.std()),
        "min": _finite(values.min()), "max": _finite(values.max()),
        "q1": _finite(values.quantile(0.25)), "q3": _finite(values.quantile(0.75)), "sum": _finite(values.sum()),
    }
    histogram = {"counts": counts.tolist(), "edges": [_finite(edge) for edge in edges]}
    return summary, histogram


def _profile_column(name, series, row_count):
    kind = _column_type(series)
    missing = int(series.isna().sum())
    column = {
        "name": name, "type": kind, "missing": missing,
        "missing_pct": round(missing / row_count * 100, 1) if row_count else 0,
        "unique": int(series.nunique(dropna=True)), "summary": None, "histogram": None, "top": None,
    }
    if kind in ("integer", "float"):
        column["summary"], column["histogram"] = _numeric_summary(series)
    else:
        top = series.dropna().astype(str).value_counts().head(TOP_VALUES)
        column["top"] = [[str(value)[:80], int(count)] for value, count in top.items()]
    return column


def profile(uploaded):
    text = _decode(uploaded)
    frame = _read(text)
    # Duplicates are counted on raw text, the same view the cleaner uses, so the numbers agree.
    duplicates = int(_read(text, dtype=str).duplicated().sum())
    rows = len(frame)
    columns = [_profile_column(name, frame[name], rows) for name in frame.columns]
    return {
        "file_name": Path(uploaded.name).name[:120],
        "rows": rows,
        "column_count": frame.shape[1],
        "missing_cells": int(frame.isna().sum().sum()),
        "rows_with_missing": int(frame.isna().any(axis=1).sum()),
        "duplicate_rows": duplicates,
        "columns": columns,
        "preview_headers": list(frame.columns),
        "preview": _json_rows(frame.head(PREVIEW_ROWS)),
    }


def _json_rows(frame):
    """Plain Python values, with every kind of missing value as None."""
    clean = frame.astype(object).where(frame.notna(), None)
    rows = []
    for row in clean.itertuples(index=False, name=None):
        rows.append([_json_cell(cell) for cell in row])
    return rows


def _json_cell(cell):
    if cell is None or isinstance(cell, (bool, str)):
        return cell
    if isinstance(cell, np.bool_):
        return bool(cell)
    if isinstance(cell, (int, np.integer)):
        return int(cell)
    if isinstance(cell, (float, np.floating)):
        return _finite(cell, digits=10)
    return str(cell)


def _neutralize_formula(value):
    """Spreadsheets execute cells starting with these characters; a leading ' disarms them."""
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        try:
            float(value)  # Plain negative numbers and the like are safe, and stay numeric.
            return value
        except ValueError:
            return f"'{value}"
    return value


def clean(uploaded, *, drop_duplicates, drop_empty_rows, drop_rows_with_missing, trim_whitespace, neutralize_formulas):
    """Returns (csv_text, rows_before, rows_after). Reads as text so "007" stays "007"."""
    frame = _read(_decode(uploaded), dtype=str)
    before = len(frame)
    if trim_whitespace:
        frame = frame.apply(lambda col: col.str.strip()).replace("", pd.NA)
    if drop_empty_rows:
        frame = frame.dropna(how="all")
    if drop_rows_with_missing:
        frame = frame.dropna(how="any")
    if drop_duplicates:
        frame = frame.drop_duplicates()
    if neutralize_formulas:
        frame = frame.apply(lambda col: col.map(_neutralize_formula))
    return frame.to_csv(index=False), before, len(frame)


def cleaned_filename(original):
    return f"{slugify(Path(original).stem) or 'data'}-cleaned.csv"
