# Git hooks might fail with Yarn on Windows using Git Bash (stdin is not a tty). For Windows users, implement this workaround:

command_exists () {
  command -v "$1" >/dev/null 2>&1
}

# Workaround for Windows 10, Git Bash, and Yarn
if command_exists winpty && test -t 1; then
  exec < /dev/tty
fi