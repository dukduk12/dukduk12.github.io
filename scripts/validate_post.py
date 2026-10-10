import sys
import re
import yaml
from pathlib import Path


def _mask_code(body: str) -> str:
    """Mask code while preserving newlines so LaTeX line numbers stay accurate."""
    masked = list(body)

    def mask_span(start, end):
        for pos in range(start, end):
            if masked[pos] != "\n":
                masked[pos] = " "

    for match in re.finditer(r'^```[^\n]*\n.*?^```\s*$', body, re.M | re.S):
        mask_span(match.start(), match.end())

    without_fences = "".join(masked)
    for match in re.finditer(r'(?<!`)`[^`\n]+`(?!`)', without_fences):
        mask_span(match.start(), match.end())

    return "".join(masked)


def _is_escaped(text: str, index: int) -> bool:
    slash_count = 0
    index -= 1
    while index >= 0 and text[index] == "\\":
        slash_count += 1
        index -= 1
    return slash_count % 2 == 1


def _line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _check_math_segment(segment: str, line: int, errors: list):
    if not segment.strip():
        errors.append(f"Empty LaTeX expression near body line {line}")
        return

    brace_stack = []
    for index, char in enumerate(segment):
        if char == "{" and not _is_escaped(segment, index):
            brace_stack.append(index)
        elif char == "}" and not _is_escaped(segment, index):
            if not brace_stack:
                errors.append(f"Unmatched '}}' in LaTeX near body line {line}")
                break
            brace_stack.pop()
    if brace_stack:
        errors.append(f"Unclosed '{{' in LaTeX near body line {line}")

    environments = []
    environment_mismatch = False
    for match in re.finditer(r'\\(begin|end)\{([^{}]+)\}', segment):
        action, name = match.groups()
        if action == "begin":
            environments.append(name)
        elif not environments or environments[-1] != name:
            expected = environments[-1] if environments else "none"
            errors.append(
                f"Mismatched LaTeX environment near body line {line}: "
                f"expected end{{{expected}}}, found end{{{name}}}"
            )
            environment_mismatch = True
            break
        else:
            environments.pop()
    if environments and not environment_mismatch:
        errors.append(
            f"Unclosed LaTeX environment near body line {line}: begin{{{environments[-1]}}}"
        )

    left_count = len(re.findall(r'\\left(?:\s|[.()\[\]{}|])', segment))
    right_count = len(re.findall(r'\\right(?:\s|[.()\[\]{}|])', segment))
    if left_count != right_count:
        errors.append(
            f"Unbalanced \\left / \\right in LaTeX near body line {line} "
            f"({left_count} left, {right_count} right)"
        )


def validate_latex(body: str, errors: list, warnings: list):
    math_text = _mask_code(body)

    legacy = list(re.finditer(r'(?<!\\)\\[()\[\]]', math_text))
    if legacy:
        locations = ", ".join(str(_line_number(math_text, m.start())) for m in legacy[:8])
        errors.append(
            "Site-unsafe LaTeX delimiters found at body line(s) "
            f"{locations}. Use $...$ and $$...$$ instead of \\(...\\) or \\[...\\]."
        )

    segments = []
    state = None
    start = None
    index = 0
    while index < len(math_text):
        if math_text[index] != "$" or _is_escaped(math_text, index):
            index += 1
            continue

        is_double = index + 1 < len(math_text) and math_text[index + 1] == "$"
        token = "display" if is_double else "inline"
        width = 2 if is_double else 1

        if state is None:
            state = token
            start = index
        elif state == token:
            content_start = start + (2 if state == "display" else 1)
            segments.append((math_text[content_start:index], start, state))
            state = None
            start = None
        elif state == "inline" and token == "display":
            errors.append(
                f"Mixed LaTeX delimiters near body line {_line_number(math_text, index)}"
            )
            state = None
            start = None
        elif state == "display" and token == "inline":
            errors.append(
                f"Unexpected single '$' inside display math near body line "
                f"{_line_number(math_text, index)}"
            )
        index += width

    if state is not None:
        delimiter = "$$" if state == "display" else "$"
        errors.append(
            f"Unclosed LaTeX delimiter '{delimiter}' starting at body line "
            f"{_line_number(math_text, start)}"
        )

    for segment, position, kind in segments:
        line = _line_number(math_text, position)
        if kind == "inline" and "\n" in segment:
            errors.append(f"Inline LaTeX crosses a line boundary near body line {line}")
        _check_math_segment(segment, line, errors)

    for match in re.finditer(r'(?m)^([^\n]*\$\$[^\n]*)$', math_text):
        if match.group(1).strip() != "$$":
            warnings.append(
                f"Display-math delimiter should be on its own line near body line "
                f"{_line_number(math_text, match.start())}"
            )

def validate_post(file_path: Path):
    if not file_path.exists():
        print(f"❌ [NOT FOUND] File does not exist: {file_path}")
        return False

    text = file_path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        print(f"❌ [FRONT-MATTER] File does not start with YAML front-matter: {file_path}")
        return False

    parts = text.split("---", 2)
    if len(parts) < 3:
        print(f"❌ [FRONT-MATTER] Malformed front-matter in: {file_path}")
        return False

    raw_yaml = parts[1]
    body = parts[2]

    try:
        meta = yaml.safe_load(raw_yaml)
    except Exception as e:
        print(f"❌ [YAML ERROR] Failed to parse front-matter: {e}")
        return False

    errors = []
    warnings = []

    # 1. Front-matter required fields
    required_keys = ["title", "date", "categories", "tags", "lang", "translations"]
    for key in required_keys:
        if key not in meta:
            errors.append(f"Missing required key '{key}' in front-matter")

    lang = meta.get("lang")
    is_ko = (lang == "ko")

    # 2. File location convention check
    rel_path = file_path.as_posix()
    if is_ko:
        if not rel_path.startswith("_pages/") and "/_pages/" not in rel_path:
            errors.append(f"Korean post (lang: ko) MUST be located in '_pages/', but found in: {file_path}")
        for ko_key in ["permalink", "related", "author_profile"]:
            if ko_key not in meta:
                errors.append(f"Missing Korean _pages required key '{ko_key}'")
        if meta.get("toc") is not True:
            errors.append("Korean _pages file should have 'toc: true' for sidebar TOC")
        if meta.get("toc_sticky") is not True:
            warnings.append("Korean _pages file recommended to have 'toc_sticky: true'")
    else:
        if not rel_path.startswith("_posts/") and "/_posts/" not in rel_path:
            errors.append(f"English post (lang: en) MUST be located in '_posts/', but found in: {file_path}")

    # 3. Epigraph quote check
    if not re.search(r'^\s*>\s*_"?[^"\n]+"?_\s*$', body, re.M):
        warnings.append("Epigraph quote (> _\"...\"_) not found or formatted unusually in opening")

    # 4. Heading & TOC structure check
    headings = re.findall(r'^(#{1,6})\s+(.+)$', body, re.M)
    if not headings:
        warnings.append("No markdown headings (# Part, ## Section) detected")
    else:
        h1_count = sum(1 for h, _ in headings if h == "#")
        if h1_count == 0:
            warnings.append("No H1 headings (#) found for major parts")

    # 5. Fenced code block syntax check
    fences = re.findall(r'^```([^\n]*)\n(.*?)^```\s*$', body, re.M | re.S)
    for idx, (lang_tag, code) in enumerate(fences, 1):
        lang_tag = lang_tag.strip().lower()
        if not lang_tag:
            warnings.append(f"Code block #{idx} is missing a language identifier")
        elif lang_tag == "json":
            import json
            try:
                json.loads(code)
            except Exception as e:
                errors.append(f"Code block #{idx} (json) has invalid JSON syntax: {e}")
        elif lang_tag == "python" or lang_tag == "py":
            try:
                compile(code, f"<block_{idx}>", "exec")
            except SyntaxError as e:
                warnings.append(f"Python code block #{idx} has syntax issue: {e}")

    # 6. LaTeX syntax and site-compatible MathJax delimiter check
    validate_latex(body, errors, warnings)

    # Report results
    print(f"\n==========================================")
    print(f"📄 Validation Report: {file_path.name}")
    print(f"   Language: {lang} | Headings: {len(headings)} | Code blocks: {len(fences)}")
    print(f"==========================================")

    if errors:
        print("❌ FAILED with errors:")
        for err in errors:
            print(f"   - {err}")
    else:
        print("✅ No critical errors found!")

    if warnings:
        print("⚠️ Warnings / Suggestions:")
        for warn in warnings:
            print(f"   - {warn}")

    return len(errors) == 0

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/validate_post.py <path-to-post-file> [<path-to-counterpart>]")
        sys.exit(1)

    all_passed = True
    for arg in sys.argv[1:]:
        p = Path(arg)
        passed = validate_post(p)
        if not passed:
            all_passed = False

    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
