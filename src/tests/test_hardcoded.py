"""ハードコード禁止チェック"""
import os
import re
import glob

SRC_DIR = os.path.join(os.path.dirname(__file__), "..")

FORBIDDEN_PATTERNS = [
    (r"secret_key\s*=\s*['\"][^'\"]{8,}['\"]", "SECRET_KEY のハードコード"),
    (r"password\s*=\s*['\"][^'\"]+['\"]", "パスワードのハードコード"),
]

PY_FILES = glob.glob(os.path.join(SRC_DIR, "**", "*.py"), recursive=True)


def test_no_hardcoded_secrets():
    violations = []
    for fpath in PY_FILES:
        if "test_" in os.path.basename(fpath):
            continue
        with open(fpath) as f:
            for lineno, line in enumerate(f, 1):
                for pattern, label in FORBIDDEN_PATTERNS:
                    if re.search(pattern, line, re.IGNORECASE):
                        violations.append(f"{fpath}:{lineno} {label}: {line.strip()}")
    assert violations == [], "\n".join(violations)


def test_no_native_alert_in_js():
    js_files = glob.glob(os.path.join(SRC_DIR, "static", "**", "*.js"), recursive=True)
    violations = []
    for fpath in js_files:
        with open(fpath) as f:
            for lineno, line in enumerate(f, 1):
                if re.search(r"\balert\s*\(", line):
                    violations.append(f"{fpath}:{lineno}: alert() 禁止")
                if re.search(r"\bconfirm\s*\(", line):
                    violations.append(f"{fpath}:{lineno}: confirm() 禁止")
                if re.search(r"\bprompt\s*\(", line):
                    violations.append(f"{fpath}:{lineno}: prompt() 禁止")
    assert violations == [], "\n".join(violations)
