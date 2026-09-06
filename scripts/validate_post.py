import sys
import re
import yaml
from pathlib import Path

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
