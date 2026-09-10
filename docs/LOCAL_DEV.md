# Running Claude Code on a local Windows PC

## Why not from a remote session

A Claude Code session running in the hosted sandbox cannot reach a machine on a
private VPN. The sandbox has no VPN interface (`eth0` and `lo` only), no route to
the `100.64.0.0/10` CGNAT range, and its egress proxy rejects the VPN vendor's
install and coordination endpoints with `connect_rejected` (organization network
policy). So the client cannot be installed there and the sandbox cannot join a
tailnet.

Run Claude Code on the local PC instead. That machine is already a VPN member, so
it reaches the other machines on the tailnet directly — no tunnel setup needed.

## Install (Windows)

Requires **Node.js 22 or newer** — the published package declares
`engines: { node: ">=22.0.0" }`.

PowerShell:

```powershell
node --version                              # must be v22+
npm install -g @anthropic-ai/claude-code
claude --version
```

Verified against the npm registry: `@anthropic-ai/claude-code`, latest `2.1.267`,
installs a single `claude` binary. A clean install of this package completed in
about 5 seconds and the resulting binary reported `2.1.267 (Claude Code)`.

If Node 22+ is not installed, get it from <https://nodejs.org> first.

Native installer alternative:

```powershell
irm https://claude.ai/install.ps1 | iex
```

## Clone and start

```powershell
git clone https://github.com/roydeb11/roy-menu-demo
cd roy-menu-demo
claude
```

Sign in on first launch when prompted.

## Serve the demo

The project is static — `index.html`, `gonder.html` and `assets/`, with no build
step:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/index.html>.

To make the dev server reachable from other machines on the tailnet, bind all
interfaces and allow the port through Windows Firewall:

```powershell
python -m http.server 8000 --bind 0.0.0.0
```

## What still works remotely

Remote sessions remain fine for this repo — editing, committing, pushing and
reviewing all function normally. Only outbound VPN traffic is restricted.
