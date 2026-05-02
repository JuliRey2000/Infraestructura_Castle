#!/usr/bin/env python3
"""
Hook: HTTPS Enforcer

REGRA: URLs externas em codigo de producao DEVEM usar https://
http:// e permitido APENAS para localhost / 127.0.0.1 / 0.0.0.0 / ::1.

Este hook intercepta Write/Edit e bloqueia se detectar URLs http://
para destinos externos em arquivos de codigo.

Exit Codes:
- 0: Permitido
- 2: Bloqueado (http externo detectado)
"""

import json
import sys
import re
import os

# =============================================================================
# CONFIGURACAO
# =============================================================================

# Pattern: http:// seguido de NAO localhost/loopback, mas hostname valido
HTTP_PATTERN = re.compile(
    r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?|example\.(?:com|org|net))'
    r'([a-zA-Z0-9][a-zA-Z0-9\-\.]+(?::[0-9]+)?(?:/[^\s"\']*)?)'
)

# Apenas verificar arquivos de codigo
CODE_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".rb", ".go", ".rs", ".java", ".kt",
    ".json", ".yaml", ".yml", ".toml",
    ".env",
}

# Linhas que sao comentarios (skip)
COMMENT_PREFIXES = ("//", "#", "<!--", "/*", "*", "--")

# Paths que indicam contexto de excecao
EXCEPTION_PATH_PATTERNS = [
    r"/tests?/",
    r"/__tests__/",
    r"\.test\.",
    r"\.spec\.",
    r"/fixtures/",
    r"/mocks/",
    r"\.example$",
    r"\.example\.",
    r"\.claude/hooks/https-enforcer\.py$",
]

# =============================================================================
# LOGICA
# =============================================================================

def is_code_file(file_path: str) -> bool:
    """Verifica se o arquivo e codigo (extensao na whitelist)."""
    if not file_path:
        return False
    _, ext = os.path.splitext(file_path)
    return ext.lower() in CODE_EXTENSIONS

def is_exception_path(file_path: str) -> bool:
    """Verifica se o path esta em contexto de excecao."""
    for pattern in EXCEPTION_PATH_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False

def line_is_comment(line: str) -> bool:
    """Verifica se a linha e comentario."""
    stripped = line.lstrip()
    for prefix in COMMENT_PREFIXES:
        if stripped.startswith(prefix):
            return True
    return False

def detect_http_urls(content: str) -> list:
    """Detecta URLs http externas, retorna lista de (line_num, url)."""
    if not content:
        return []
    detected = []
    for line_num, line in enumerate(content.split("\n"), 1):
        if line_is_comment(line):
            continue
        for match in HTTP_PATTERN.finditer(line):
            full_url = "http://" + match.group(1)
            detected.append((line_num, full_url))
            if len(detected) >= 5:
                return detected
    return detected

def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    file_path = tool_input.get("file_path", "")

    if not is_code_file(file_path):
        sys.exit(0)

    if is_exception_path(file_path):
        sys.exit(0)

    if tool_name == "Write":
        content = tool_input.get("content", "")
    else:
        content = tool_input.get("new_string", "")

    detected = detect_http_urls(content)

    if not detected:
        sys.exit(0)

    detected_lines = "\n".join(
        [f"║    line {ln:<4}  {url[:62]:<62}║"
         for ln, url in detected[:5]]
    )

    error_message = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  HTTPS ENFORCER: URL http:// externa detectada                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  URLs encontradas (devem usar https://):                                     ║
{detected_lines}
║                                                                              ║
║  REGRA Castle Capital Security:                                              ║
║                                                                              ║
║    Toda comunicacao externa DEVE usar https://                               ║
║    http:// e permitido APENAS para:                                          ║
║      - localhost                                                             ║
║      - 127.0.0.1, 0.0.0.0, ::1                                               ║
║      - example.com (placeholders em docs)                                    ║
║                                                                              ║
║  ACAO REQUERIDA:                                                             ║
║                                                                              ║
║    Substitua http:// por https:// nas URLs acima                             ║
║                                                                              ║
║  RAZAO:                                                                      ║
║                                                                              ║
║    Castle Capital opera com capital real. http:// expoe credenciais          ║
║    e permite MITM. Para DeFi (Uniswap, Revert), uma intercepcao              ║
║    pode resultar em perda de fundos.                                         ║
║                                                                              ║
║  File: {file_path[:60]:<60}              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
    print(error_message, file=sys.stderr)
    sys.exit(2)

if __name__ == "__main__":
    main()
