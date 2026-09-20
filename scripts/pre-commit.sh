#!/bin/sh
# Blocks a commit if it would include .env* files or anything that looks
# like a live API key/secret — a real guard rail, not just a .gitignore
# entry someone could accidentally override with `git add -f`.
#
# Install (one-time, per clone):
#   cp scripts/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

STAGED=$(git diff --cached --name-only)

# 1. Block staged .env files outright (.env.example is fine — it's all placeholders).
for f in $STAGED; do
  case "$f" in
    .env|.env.local|.env.*.local|*.env)
      echo "❌ Blocked: '$f' is staged for commit. This looks like a real env file, not .env.example."
      echo "   Run: git restore --staged $f"
      exit 1
      ;;
  esac
done

# 2. Scan staged file CONTENTS for common live-secret patterns, in case a
# key got pasted into some other file (a comment, a doc, a test fixture).
PATTERN='sb_secret_[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----'

for f in $STAGED; do
  if [ -f "$f" ]; then
    if git diff --cached -- "$f" | grep -E "$PATTERN" > /dev/null 2>&1; then
      echo "❌ Blocked: '$f' appears to contain a live secret (matched a known key format)."
      echo "   If this is a false positive, review and commit with --no-verify."
      exit 1
    fi
  fi
done

exit 0
