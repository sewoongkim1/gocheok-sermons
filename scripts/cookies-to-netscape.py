#!/usr/bin/env python3
# YT_COOKIES 시크릿을 yt-dlp가 요구하는 Netscape(.txt) 형식으로 정규화한다.
# 브라우저 확장(Cookie-Editor / EditThisCookie 등)에서 내보낸 JSON을 붙여넣어도,
# 이미 Netscape 형식이어도 모두 처리한다.
#   사용법: python3 scripts/cookies-to-netscape.py <입력(raw)> <출력(.txt)>
import sys, json

src, dst = sys.argv[1], sys.argv[2]
raw = open(src, encoding="utf-8").read().strip()


def to_netscape(cookies):
    lines = ["# Netscape HTTP Cookie File", "# Auto-generated from YT_COOKIES secret", ""]
    n = 0
    for c in cookies:
        domain = (c.get("domain") or "").strip()
        name = c.get("name", "")
        if not domain or not name:
            continue
        value = c.get("value", "")
        path = c.get("path") or "/"
        secure = "TRUE" if c.get("secure") else "FALSE"
        exp = c.get("expirationDate", c.get("expires", c.get("expiry", 0))) or 0
        try:
            exp = int(float(exp))
        except Exception:
            exp = 0
        include_sub = "TRUE" if domain.startswith(".") else "FALSE"
        prefix = "#HttpOnly_" if c.get("httpOnly") else ""
        lines.append("\t".join([prefix + domain, include_sub, path, secure, str(exp), name, value]))
        n += 1
    return "\n".join(lines) + "\n", n


if raw[:1] in ("[", "{"):
    data = json.loads(raw)
    cookies = data.get("cookies", data) if isinstance(data, dict) else data
    out, n = to_netscape(cookies)
    open(dst, "w", encoding="utf-8", newline="\n").write(out)
    print(f"쿠키 형식: JSON → Netscape 변환 ({n}개)")
else:
    text = raw
    if not text.startswith("# Netscape") and "\t" in text:
        text = "# Netscape HTTP Cookie File\n" + text
    if not text.endswith("\n"):
        text += "\n"
    open(dst, "w", encoding="utf-8", newline="\n").write(text)
    print("쿠키 형식: Netscape(그대로 사용)")
