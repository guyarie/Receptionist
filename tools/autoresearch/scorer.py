#!/usr/bin/env python3
"""
Scorer — Calls an LLM to evaluate receptionist responses.
Takes a prompt as argv[1] or stdin, outputs JSON.

Uses OpenRouter API. The API key is fetched from the remote server's .env
to avoid storing secrets locally.
"""

import json
import sys
import urllib.request
import ssl
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def _load_env():
    env = {}
    for line in (SCRIPT_DIR / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


_ENV = _load_env()

# Fetch OpenRouter key from server (not stored locally)
result = subprocess.run(
    ["sshpass", "-p", _ENV["REMOTE_PASS"], "ssh", "-o", "StrictHostKeyChecking=no",
     _ENV["REMOTE_HOST"], "grep -o 'OPENROUTER_API_KEY=.*' /opt/receptionist/.env | cut -d= -f2"],
    capture_output=True, text=True, timeout=15
)
OPENROUTER_KEY = result.stdout.strip()

if not OPENROUTER_KEY:
    print(json.dumps({"error": "Could not fetch OpenRouter API key"}))
    sys.exit(1)

SCORER_MODEL = _ENV.get("SCORER_MODEL", "openai/gpt-4o")

prompt = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()

payload = json.dumps({
    "model": SCORER_MODEL,
    "messages": [
        {"role": "system", "content": "You are a strict evaluator. Respond ONLY in valid JSON. No markdown, no explanation outside JSON."},
        {"role": "user", "content": prompt}
    ],
    "temperature": 0.1,
    "max_tokens": 2000
}).encode()

req = urllib.request.Request(
    "https://openrouter.ai/api/v1/chat/completions",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_KEY}",
    }
)

ctx = ssl.create_default_context()
try:
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        data = json.loads(resp.read())
        content = data["choices"][0]["message"]["content"]
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        parsed = json.loads(content)
        print(json.dumps(parsed))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
