#!/usr/bin/env python3
"""
Hook: Dependency Audit

REGRA: Pacotes npm com historico conhecido de supply chain attacks
estao BLOQUEADOS. Outros pacotes geram aviso para rodar npm audit.

Este hook intercepta comandos Bash que executam `npm install <package>`
ou `npm i <package>` e:
- BLOQUEIA se o pacote estiver em blacklist
- AVISA para rodar npm audit em outros casos

Exit Codes:
- 0: Permitido (com possivel aviso)
- 2: Bloqueado (pacote malicioso conhecido)
"""

import json
import sys
import re

# =============================================================================
# CONFIGURACAO
# =============================================================================

BLOCKED_PACKAGES = {
    "event-stream": "Supply chain attack 2018 (flatmap-stream injection)",
    "flatmap-stream": "Malicious package, supply chain attack 2018",
    "ua-parser-js@0.7.29": "Compromised version 2021 (cryptominer)",
    "ua-parser-js@0.8.0": "Compromised version 2021",
    "ua-parser-js@1.0.0": "Compromised version 2021",
    "rc@1.2.9": "Compromised version Nov 2021",
    "rc@1.3.9": "Compromised version Nov 2021",
    "rc@2.3.9": "Compromised version Nov 2021",
    "coa@2.0.3": "Compromised version Nov 2021",
    "coa@2.0.4": "Compromised version Nov 2021",
    "coa@2.1.1": "Compromised version Nov 2021",
    "coa@2.1.3": "Compromised version Nov 2021",
    "coa@3.0.1": "Compromised version Nov 2021",
    "node-ipc@10.1.1": "Protestware Mar 2022",
    "node-ipc@10.1.2": "Protestware Mar 2022",
    "node-ipc@10.1.3": "Protestware Mar 2022",
    "colors@1.4.1": "Sabotage Jan 2022 (infinite loop)",
    "colors@1.4.2": "Sabotage Jan 2022",
    "faker@6.6.6": "Sabotage Jan 2022 (empty package)",
}

# Patterns de instalacao npm
INSTALL_PATTERN = re.compile(
    r'\bnpm\s+(?:install|i|add)\s+([^\s][^|;&]*?)(?:\s|$)',
    re.IGNORECASE
)

# Packages tambem cobertos por yarn/pnpm
YARN_PATTERN = re.compile(
    r'\b(?:yarn|pnpm)\s+(?:add|install)\s+([^\s][^|;&]*?)(?:\s|$)',
    re.IGNORECASE
)

# Comandos que NAO sao instalacao de pacote especifico (skip)
SKIP_PATTERNS = [
    r'\bnpm\s+install\s*$',           # bare npm install
    r'\bnpm\s+install\s+--?\w',       # npm install --flag (no package)
    r'\bnpm\s+i\s*$',                 # bare npm i
    r'\byarn\s*$',                    # bare yarn
    r'\byarn\s+install\s*$',          # bare yarn install
    r'\bpnpm\s+install\s*$',          # bare pnpm install
]

# =============================================================================
# LOGICA
# =============================================================================

def should_skip(command: str) -> bool:
    """Verifica se o comando deve ser ignorado (instalacao geral, nao especifica)."""
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, command):
            return True
    return False

def extract_packages(command: str) -> list:
    """Extrai nomes de pacotes do comando install."""
    packages = []

    for match in INSTALL_PATTERN.finditer(command):
        args = match.group(1).strip()
        for token in args.split():
            if token.startswith("-"):
                continue
            packages.append(token)

    for match in YARN_PATTERN.finditer(command):
        args = match.group(1).strip()
        for token in args.split():
            if token.startswith("-"):
                continue
            packages.append(token)

    return packages

def check_blocked(packages: list) -> list:
    """Verifica se algum pacote esta na blacklist."""
    blocked = []
    for pkg in packages:
        if pkg in BLOCKED_PACKAGES:
            blocked.append((pkg, BLOCKED_PACKAGES[pkg]))
            continue
        pkg_no_version = pkg.split("@")[0] if not pkg.startswith("@") else \
                         "@" + pkg[1:].split("@")[0]
        if pkg_no_version in BLOCKED_PACKAGES:
            blocked.append((pkg, BLOCKED_PACKAGES[pkg_no_version]))
    return blocked

def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name != "Bash":
        sys.exit(0)

    command = tool_input.get("command", "")
    if not command:
        sys.exit(0)

    if should_skip(command):
        sys.exit(0)

    packages = extract_packages(command)
    if not packages:
        sys.exit(0)

    blocked = check_blocked(packages)

    if blocked:
        blocked_lines = "\n".join(
            [f"║    - {pkg[:25]:<25}  {reason[:42]:<42}║"
             for pkg, reason in blocked[:5]]
        )
        error_message = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  DEPENDENCY AUDIT: Pacote em blacklist detectado                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Pacotes BLOQUEADOS:                                                         ║
{blocked_lines}
║                                                                              ║
║  REGRA Castle Capital Security:                                              ║
║                                                                              ║
║    Pacotes com historico conhecido de supply chain attacks                   ║
║    NAO podem ser instalados.                                                 ║
║                                                                              ║
║  ACAO REQUERIDA:                                                             ║
║                                                                              ║
║    1. NAO instale este pacote                                                ║
║    2. Procure alternativa segura (npm audit, snyk.io)                        ║
║    3. Se versao especifica: pin uma versao posterior segura                  ║
║                                                                              ║
║  RAZAO:                                                                      ║
║                                                                              ║
║    Castle Capital lida com chaves privadas e capital DeFi.                   ║
║    Supply chain attack pode roubar fundos de clientes.                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
        print(error_message, file=sys.stderr)
        sys.exit(2)

    pkg_list = ", ".join(packages[:5])
    if len(packages) > 5:
        pkg_list += f" (+{len(packages) - 5} more)"

    advisory = f"""
+------------------------------------------------------------------------------+
|  DEPENDENCY AUDIT: Reminder                                                  |
+------------------------------------------------------------------------------+
|  Instalando: {pkg_list[:62]:<62}|
|                                                                              |
|  Apos instalar, execute:                                                     |
|    npm audit --audit-level=moderate                                          |
|                                                                              |
|  Verifique severity HIGH/CRITICAL e corrija antes de commit.                 |
+------------------------------------------------------------------------------+
"""
    print(advisory, file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()
