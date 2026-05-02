#!/usr/bin/env python3
"""
Hook: Secrets Scanner

REGRA: Credenciais hardcoded (API keys, private keys, tokens, passwords)
SAO PROIBIDAS em codigo. Use variaveis de ambiente.

Este hook intercepta operacoes Write/Edit e bloqueia se detectar
patterns de secretos no conteudo a ser escrito.

Exit Codes:
- 0: Permitido
- 2: Bloqueado (secreto detectado)
"""

import json
import sys
import re
import os

# =============================================================================
# CONFIGURACAO: Patterns de secretos a detectar
# =============================================================================

SECRET_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\'][A-Za-z0-9_\-]{16,}["\']',
     "API Key hardcoded"),
    (r'sk-[a-zA-Z0-9]{32,}',
     "OpenAI/Anthropic SK key"),
    (r'sk-ant-[a-zA-Z0-9_\-]{20,}',
     "Anthropic API key"),
    (r'xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+',
     "Slack Bot token"),
    (r'(?i)private[_-]?key\s*[=:]\s*["\'][0-9a-fA-F]{64}["\']',
     "Crypto private key (hex 64)"),
    (r'(?i)(password|passwd|secret|token)\s*[=:]\s*["\'][^"\']{8,}["\']',
     "Hardcoded credential (password/secret/token)"),
    (r'Bearer\s+[A-Za-z0-9._\-]{20,}',
     "Bearer token hardcoded"),
    (r'(?i)mnemonic\s*[=:]\s*["\'](?:[a-z]+\s+){11,}[a-z]+["\']',
     "Crypto seed phrase / mnemonic"),
    (r'AKIA[0-9A-Z]{16}',
     "AWS Access Key ID"),
    (r'(?i)aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["\'][A-Za-z0-9/+=]{40}["\']',
     "AWS Secret Access Key"),
    (r'ghp_[A-Za-z0-9]{36}',
     "GitHub Personal Access Token"),
    (r'ghs_[A-Za-z0-9]{36}',
     "GitHub App Token"),
]

# Strings que indicam placeholder/exemplo (skip)
# Devem ser especificos para nao gerar falsos negativos com substrings comuns
EXCEPTION_STRINGS = [
    "your_key_here",
    "your_api_key",
    "replace_me",
    "replace_with",
    "example_key",
    "placeholder",
    "xxxxxxxxxxxx",   # min 12 x's, evita match parcial
    "<your_",
    "<api_key",
    "<token>",
    "<secret>",
    "your-key-here",
    "your-token-here",
    "dummy_key",
    "fake_key",
    "test_key_",
    "example.com",
    "changeme",
]

# Paths que indicam contexto seguro (skip)
EXCEPTION_PATH_PATTERNS = [
    r"/tests?/",
    r"/__tests__/",
    r"\.test\.",
    r"\.spec\.",
    r"\.example$",
    r"\.example\.",
    r"\.sample$",
    r"/fixtures/",
    r"/mocks/",
    r"/__mocks__/",
    r"\.md$",
    r"/docs/",
    r"\.claude/hooks/secrets-scanner\.py$",
]

# =============================================================================
# LOGICA DO HOOK
# =============================================================================

def is_exception_path(file_path: str) -> bool:
    """Verifica se o path esta em contexto de excecao."""
    if not file_path:
        return False
    for pattern in EXCEPTION_PATH_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False

def has_exception_string(matched_text: str) -> bool:
    """Verifica se o match contem placeholder/exemplo."""
    lower = matched_text.lower()
    for exc in EXCEPTION_STRINGS:
        if exc.lower() in lower:
            return True
    return False

def detect_secrets(content: str) -> list:
    """Detecta secretos no conteudo, retorna lista de (description, sample)."""
    if not content:
        return []
    detected = []
    for pattern, description in SECRET_PATTERNS:
        for match in re.finditer(pattern, content):
            matched = match.group(0)
            if has_exception_string(matched):
                continue
            sample = matched[:40] + "..." if len(matched) > 40 else matched
            detected.append((description, sample))
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

    if is_exception_path(file_path):
        sys.exit(0)

    if tool_name == "Write":
        content = tool_input.get("content", "")
    else:
        content = tool_input.get("new_string", "")

    detected = detect_secrets(content)

    if not detected:
        sys.exit(0)

    detected_lines = "\n".join(
        [f"║    - {desc:<35}  sample: {sample[:30]:<30}║"
         for desc, sample in detected[:5]]
    )

    error_message = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECRETS SCANNER: Credencial hardcoded detectada                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Patterns detectados:                                                        ║
{detected_lines}
║                                                                              ║
║  REGRA Castle Capital Security:                                              ║
║                                                                              ║
║    Credenciais hardcoded (API keys, tokens, private keys, passwords)         ║
║    estao PROIBIDAS em codigo fonte. Use variaveis de ambiente.               ║
║                                                                              ║
║  ACAO REQUERIDA:                                                             ║
║                                                                              ║
║    1. Mover o secreto para variavel de ambiente                              ║
║       Node.js:  process.env.API_KEY                                          ║
║       Python:   os.environ["API_KEY"]                                        ║
║                                                                              ║
║    2. Adicionar referencia em .env.example com placeholder                   ║
║       Ex: API_KEY=YOUR_KEY_HERE                                              ║
║                                                                              ║
║    3. Nunca commitar .env (verificar .gitignore)                             ║
║                                                                              ║
║    4. Se o secreto ja foi exposto: ROTAR IMEDIATAMENTE                       ║
║                                                                              ║
║  EXCECOES (skip automatico):                                                 ║
║    - Arquivos em tests/, __tests__/, mocks/                                  ║
║    - Strings com placeholder (YOUR_KEY_HERE, REPLACE_ME, etc)                ║
║    - Arquivos .example, .sample                                              ║
║                                                                              ║
║  File: {file_path[:60]:<60}              ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
    print(error_message, file=sys.stderr)
    sys.exit(2)

if __name__ == "__main__":
    main()
