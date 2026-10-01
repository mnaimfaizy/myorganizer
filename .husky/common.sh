# Git hooks might fail with Yarn on Windows using Git Bash (stdin is not a tty). For Windows users, implement this workaround:

command_exists () {
  command -v "$1" >/dev/null 2>&1
}

# Workaround for Windows 10, Git Bash, and Yarn
if command_exists winpty && test -t 1; then
  exec < /dev/tty
fi

# NOTE: yarn commands in hooks use `corepack yarn` directly to bypass the need
# for `corepack enable` shims (which require admin rights on Windows).

# Stop the commit at the first command that fails. Without this, a later
# command that exits 0 lets the hook succeed after an earlier one failed.
# Sourcing this file is what turns it on, and a commit where Husky is not
# installed never sources it.
set -e