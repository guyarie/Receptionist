#!/usr/bin/env python3
"""
Autoresearch — Automated Prompt Optimization for AI Receptionists
Inspired by Karpathy's autoresearch method.

Runs your system prompt against test scenarios, scores against criteria,
suggests improvements, and iterates.

Usage:
  python3 run.py baseline          # Score current prompt
  python3 run.py improve           # Run one improvement round
  python3 run.py loop [N]          # Run N improvement rounds (default 5)
  python3 run.py report            # Show history of all rounds
"""

import json
import os
import sys
import subprocess
import datetime
import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SCENARIOS_FILE = SCRIPT_DIR / "scenarios.json"
CRITERIA_FILE = SCRIPT_DIR / "criteria.json"
RESULTS_DIR = SCRIPT_DIR / "results"
CHANGELOG_FILE = SCRIPT_DIR / "changelog.md"


def _load_env():
    """Load credentials from .env file."""
    env = {}
    env_file = SCRIPT_DIR / ".env"
    if not env_file.exists():
        print("❌ Missing .env file! Copy .env.example and fill in credentials.")
        sys.exit(1)
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


_ENV = _load_env()
REMOTE_HOST = _ENV["REMOTE_HOST"]
REMOTE_PASS = _ENV["REMOTE_PASS"]
REMOTE_PROMPT = _ENV["REMOTE_PROMPT"]
RECEPTIONIST_URL = _ENV["RECEPTIONIST_URL"]
SERVICE_NAME = _ENV.get("SERVICE_NAME", "receptionist")

LOCAL_PROMPT_BACKUP = SCRIPT_DIR / "prompt-backup.txt"
LOCAL_PROMPT_CURRENT = SCRIPT_DIR / "prompt-current.txt"


def ssh_cmd(cmd):
    """Run a command on the remote server."""
    full = f"sshpass -p '{REMOTE_PASS}' ssh -o StrictHostKeyChecking=no {REMOTE_HOST} '{cmd}'"
    result = subprocess.run(full, shell=True, capture_output=True, text=True, timeout=30)
    return result.stdout.strip()


def fetch_prompt():
    """Download current system prompt from server."""
    prompt = ssh_cmd(f"cat {REMOTE_PROMPT}")
    LOCAL_PROMPT_CURRENT.write_text(prompt)
    return prompt


def push_prompt(prompt_text):
    """Upload new system prompt to server and restart service."""
    LOCAL_PROMPT_CURRENT.write_text(prompt_text)
    tmp = "/tmp/autoresearch-prompt-upload.txt"
    Path(tmp).write_text(prompt_text)
    subprocess.run(
        f"sshpass -p '{REMOTE_PASS}' scp -o StrictHostKeyChecking=no {tmp} {REMOTE_HOST}:{REMOTE_PROMPT}",
        shell=True, capture_output=True, timeout=30
    )
    ssh_cmd(f"systemctl restart {SERVICE_NAME}")
    import time
    time.sleep(3)


def simulate_conversation(scenario, system_prompt):
    """Simulate a conversation using the receptionist's webchat API."""
    import urllib.request
    import ssl
    import uuid

    ctx = ssl.create_default_context()
    messages = []
    david_responses = []
    session_id = f"autoresearch-{uuid.uuid4().hex[:8]}"

    for user_msg in scenario["messages"]:
        messages.append({"role": "user", "content": user_msg})

        payload = json.dumps({
            "sessionId": session_id,
            "messages": messages
        }).encode()

        req = urllib.request.Request(
            f"{RECEPTIONIST_URL}/api/webchat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                data = json.loads(resp.read())
                david_reply = data.get("response", data.get("reply", ""))
                if isinstance(david_reply, dict):
                    david_reply = david_reply.get("response", str(david_reply))
                david_responses.append(david_reply)
                messages.append({"role": "assistant", "content": david_reply})
        except Exception as e:
            david_responses.append(f"[ERROR: {e}]")
            messages.append({"role": "assistant", "content": "[ERROR]"})

    return {
        "scenario_id": scenario["id"],
        "description": scenario.get("description", ""),
        "conversation": messages,
        "david_responses": david_responses
    }


def score_conversation(conv_result, criteria, system_prompt):
    """Use an LLM to score a conversation against criteria."""
    applicable = [c for c in criteria if conv_result["scenario_id"] in c["applies_to"]]
    if not applicable:
        return {"scenario_id": conv_result["scenario_id"], "checks": [], "score": 1.0, "passed": 0, "total": 0}

    conv_text = ""
    for msg in conv_result["conversation"]:
        role = "Customer" if msg["role"] == "user" else "Receptionist"
        conv_text += f"{role}: {msg['content']}\n"

    checks_text = "\n".join([f"- {c['id']}: {c['question']}" for c in applicable])

    scoring_prompt = f"""Score this conversation. For each criterion, answer YES or NO only.

CONVERSATION:
{conv_text}

CRITERIA (answer YES if met, NO if not):
{checks_text}

Respond in JSON format exactly like this:
{{"results": [{{"id": "criterion_id", "pass": true/false, "reason": "brief reason"}}]}}

Be strict. If borderline, score NO."""

    result = subprocess.run(
        ["python3", str(SCRIPT_DIR / "scorer.py"), scoring_prompt],
        capture_output=True, text=True, timeout=120
    )

    try:
        scores = json.loads(result.stdout)
        passed = sum(1 for r in scores["results"] if r["pass"])
        total = len(scores["results"])
        return {
            "scenario_id": conv_result["scenario_id"],
            "checks": scores["results"],
            "score": passed / total if total > 0 else 1.0,
            "passed": passed,
            "total": total
        }
    except (json.JSONDecodeError, KeyError):
        print(f"  ⚠️  Scoring failed for {conv_result['scenario_id']}: {result.stdout[:200]}")
        return {
            "scenario_id": conv_result["scenario_id"],
            "checks": [],
            "score": 0.0,
            "passed": 0,
            "total": 0,
            "error": result.stdout[:500]
        }


def run_baseline():
    """Score the current prompt against all scenarios."""
    print("📥 Fetching current prompt from server...")
    prompt = fetch_prompt()

    if not LOCAL_PROMPT_BACKUP.exists():
        LOCAL_PROMPT_BACKUP.write_text(prompt)
        print("💾 Saved backup of original prompt")

    scenarios = json.loads(SCENARIOS_FILE.read_text())
    criteria = json.loads(CRITERIA_FILE.read_text())["criteria"]

    print(f"\n🧪 Running {len(scenarios)} scenarios...")
    all_scores = []

    for scenario in scenarios:
        print(f"  ▸ {scenario['id']}...", end=" ", flush=True)
        conv = simulate_conversation(scenario, prompt)
        score = score_conversation(conv, criteria, prompt)
        all_scores.append(score)
        status = "✅" if score["score"] >= 0.8 else "⚠️" if score["score"] >= 0.5 else "❌"
        print(f"{status} {score.get('passed', '?')}/{score.get('total', '?')} ({score['score']:.0%})")

    total_passed = sum(s.get("passed", 0) for s in all_scores)
    total_checks = sum(s.get("total", 0) for s in all_scores)
    overall = total_passed / total_checks if total_checks > 0 else 0

    print(f"\n{'='*50}")
    print(f"📊 BASELINE SCORE: {total_passed}/{total_checks} ({overall:.0%})")
    print(f"{'='*50}")

    RESULTS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    result_file = RESULTS_DIR / f"baseline_{timestamp}.json"
    result_file.write_text(json.dumps({
        "timestamp": timestamp,
        "type": "baseline",
        "overall_score": overall,
        "total_passed": total_passed,
        "total_checks": total_checks,
        "scenarios": all_scores
    }, indent=2))
    print(f"💾 Results saved to {result_file}")

    print("\n❌ Failed checks:")
    for s in all_scores:
        for check in s.get("checks", []):
            if not check.get("pass"):
                print(f"  [{s['scenario_id']}] {check['id']}: {check.get('reason', 'no reason')}")

    return overall, all_scores


def generate_improvement(all_scores, current_prompt):
    """Use an LLM to suggest ONE targeted improvement based on failures."""
    failures = []
    for s in all_scores:
        for check in s.get("checks", []):
            if not check.get("pass"):
                failures.append(f"[{s['scenario_id']}] {check['id']}: {check.get('reason', '')}")

    if not failures:
        print("✅ No failures to improve!")
        return None

    failures_text = "\n".join(failures)

    improvement_prompt = f"""You are optimizing an AI receptionist's system prompt. Here are the criteria it FAILED:

{failures_text}

Current system prompt (first 500 chars for context):
{current_prompt[:500]}...

Rules:
1. Suggest exactly ONE small, targeted change to the system prompt
2. The change should fix the most common failure pattern
3. Be specific — give the exact text to add/modify/remove
4. Do NOT rewrite the whole prompt — surgical edit only
5. Explain WHY this change should help

Respond in JSON:
{{"change_description": "what you're changing and why",
 "search_text": "exact text in current prompt to find (or empty if adding new section)",
 "replacement_text": "exact replacement text (or new text to add)",
 "action": "replace|add_after|add_before"}}"""

    result = subprocess.run(
        ["python3", str(SCRIPT_DIR / "scorer.py"), improvement_prompt],
        capture_output=True, text=True, timeout=120
    )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"⚠️  Could not parse improvement suggestion: {result.stdout[:300]}")
        return None


def apply_improvement(prompt, improvement):
    """Apply the suggested improvement to the prompt."""
    action = improvement.get("action", "replace")
    search = improvement.get("search_text", "")
    replacement = improvement.get("replacement_text", "")

    if action == "replace" and search:
        if search in prompt:
            return prompt.replace(search, replacement, 1)
        else:
            print(f"⚠️  Search text not found in prompt, appending instead")
            return prompt + "\n" + replacement
    elif action == "add_after" and search:
        if search in prompt:
            idx = prompt.index(search) + len(search)
            return prompt[:idx] + "\n" + replacement + prompt[idx:]
        else:
            return prompt + "\n" + replacement
    elif action == "add_before" and search:
        if search in prompt:
            idx = prompt.index(search)
            return prompt[:idx] + replacement + "\n" + prompt[idx:]
        else:
            return prompt + "\n" + replacement
    else:
        return prompt + "\n" + replacement


def run_improve():
    """Run one improvement round."""
    print("📥 Fetching current prompt...")
    prompt = fetch_prompt()

    print("\n📊 Scoring current state...")
    baseline_score, baseline_results = run_baseline()

    if baseline_score >= 0.95:
        print("\n🎉 Score is already 95%+! Nothing to improve.")
        return baseline_score

    print("\n🧠 Analyzing failures and generating improvement...")
    improvement = generate_improvement(baseline_results, prompt)

    if not improvement:
        print("⚠️  No improvement generated.")
        return baseline_score

    print(f"\n📝 Suggested change: {improvement.get('change_description', 'unknown')}")

    new_prompt = apply_improvement(prompt, improvement)

    print("\n🚀 Pushing improved prompt to server...")
    push_prompt(new_prompt)

    print("\n📊 Scoring improved version...")
    new_score, new_results = run_baseline()

    if new_score > baseline_score:
        print(f"\n✅ IMPROVEMENT: {baseline_score:.0%} → {new_score:.0%}")
        log_change(improvement, baseline_score, new_score, kept=True)
        return new_score
    else:
        print(f"\n❌ NO IMPROVEMENT: {baseline_score:.0%} → {new_score:.0%}. Reverting...")
        push_prompt(prompt)
        log_change(improvement, baseline_score, new_score, kept=False)
        return baseline_score


def log_change(improvement, old_score, new_score, kept):
    """Log the change to changelog."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    status = "✅ KEPT" if kept else "❌ REVERTED"
    entry = f"""
## {timestamp} — {status}
- **Change:** {improvement.get('change_description', 'unknown')}
- **Score:** {old_score:.0%} → {new_score:.0%}
- **Action:** {improvement.get('action', 'unknown')}
"""
    with open(CHANGELOG_FILE, "a") as f:
        f.write(entry)


def run_loop(rounds=5):
    """Run multiple improvement rounds."""
    print(f"🔄 Running {rounds} improvement rounds...\n")
    score = 0
    for i in range(rounds):
        print(f"\n{'='*50}")
        print(f"🔄 ROUND {i+1}/{rounds}")
        print(f"{'='*50}")
        score = run_improve()
        if score >= 0.95:
            print(f"\n🎉 Hit 95%+ after {i+1} rounds! Stopping.")
            break
    print(f"\n📊 Final score: {score:.0%}")


def show_report():
    """Show all results."""
    if not RESULTS_DIR.exists():
        print("No results yet. Run 'baseline' first.")
        return

    results = sorted(RESULTS_DIR.glob("*.json"))
    for r in results:
        data = json.loads(r.read_text())
        print(f"{data['timestamp']} | {data['type']} | {data['overall_score']:.0%} ({data['total_passed']}/{data['total_checks']})")

    if CHANGELOG_FILE.exists():
        print(f"\n📋 Changelog:\n{CHANGELOG_FILE.read_text()}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "baseline"

    if cmd == "baseline":
        run_baseline()
    elif cmd == "improve":
        run_improve()
    elif cmd == "loop":
        rounds = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        run_loop(rounds)
    elif cmd == "report":
        show_report()
    else:
        print(__doc__)
