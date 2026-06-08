FROM node:22-bookworm

# Install system dependencies.
# build-essential + python3: required to compile native modules (bcrypt).
# libssl-dev: required by Prisma client at runtime.
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  build-essential \
  python3 \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Enable Corepack and pre-warm Yarn 4.13.0 (pinned via packageManager in package.json).
# Pre-warming avoids a network download on first `corepack yarn install` inside the container.
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# Sandcastle bind-mounts the git worktree at /home/agent/workspace at container start.
# The agent should run `corepack yarn install --immutable` as its first step.
ENTRYPOINT ["sleep", "infinity"]
