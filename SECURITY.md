
# Security Policy

## Supported Versions

The following versions of **HEX-MAN Offline Game** are currently maintained and receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | ✅ Yes              |
| 1.x     | ❌ No               |
| < 1.0   | ❌ No               |

> The latest version is always available at the [live demo](https://sarthak-rautela.github.io/Hexman-Offline-Game/).

---

## Reporting a Vulnerability

HEX-MAN is a client-side browser game with **no backend, no database, and no user authentication**. However, we still take security seriously — especially issues that could affect users who download or embed the game.

### What to Report

Please report issues such as:

- **Malicious script injection** (XSS) in any game component
- **Unsafe use of `eval()` or dynamic code execution**
- **Dependency vulnerabilities** (if any third-party libraries are added in future versions)
- **Data leakage** — e.g., unintended exposure of data through `localStorage` or browser APIs
- **Compromised GitHub Pages deployment** or supply chain issues

### How to Report

1. **Do NOT open a public GitHub Issue** for security vulnerabilities.
2. Instead, email directly at: **sarthakrautela80@gmail.com**

Please include:

- A description of the vulnerability
- Steps to reproduce it
- The browser and OS you tested on
- Any proof-of-concept code (if applicable)

---

## Response Timeline

| Step                        | Timeframe         |
| --------------------------- | ----------------- |
| Acknowledgement of report   | Within **48 hours** |
| Initial assessment          | Within **5 days**   |
| Fix or mitigation released  | Within **14 days**  |
| Public disclosure (if any)  | After fix is live   |

---

## Scope

Since HEX-MAN runs entirely in the browser with no server-side code:

- 🔒 This project does not collect or store any user data.
- ✅ **In scope:** Client-side JS vulnerabilities, XSS, unsafe API usage, GitHub Pages config
- ❌ **Out of scope:** Server attacks (no server exists), social engineering, spam

---

## Credits

Responsible disclosures will be credited in the project's README under an **Acknowledgements** section (unless you prefer to remain anonymous).

---

*Security policy maintained by [@SARTHAK-RAUTELA](https://github.com/SARTHAK-RAUTELA)*
