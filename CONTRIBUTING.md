# Contributing to NarrateAI 🎃

Thank you for your interest in contributing to **NarrateAI** as part of the **GDGOC PSIT Hacktoberfest** programme!

We welcome contributions of all kinds: bug fixes, documentation improvements, UI/UX polish, unit tests, and new feature additions.

---

## 🏆 Points & Difficulty System

Each issue is assigned a difficulty label that awards points tracked by our Hacktoberfest webhook:

| Difficulty | Label | Points | Description |
|---|---|---|---|
| **Easy** | `easy` | **20 pts** | Small UI adjustments, documentation, sample stories, accessibility |
| **Medium** | `medium` | **40 pts** | Bug fixes, speech chunking, component refactoring, test suites |
| **Hard** | `hard` | **80 pts** | Complex features, browser extensions, backend integrations |

> **Note**: Every valid contribution issue has exactly one difficulty label (`easy`, `medium`, or `hard`) and the `hacktoberfest` label.

---

## 📋 Contribution Workflow

Follow these steps carefully to ensure your work is tracked and approved:

### 1. Claim an Issue
- Browse open issues on the [PSIT-GDGOC/narrate-ai Issues tab](https://github.com/PSIT-GDGOC/narrate-ai/issues).
- **Claim the issue on the GDGOC Hacktoberfest portal first** before starting work.
- Each issue has a **~48-hour claim timer**. If a PR is not submitted within this window, the issue may be released for others to claim.
- Please only claim **one issue at a time**.

### 2. Fork and Clone
1. Fork the [PSIT-GDGOC/narrate-ai](https://github.com/PSIT-GDGOC/narrate-ai) repository to your GitHub account.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/narrate-ai.git
   cd narrate-ai
   ```
3. Create a new branch with the naming format `fix-issue-<number>`:
   ```bash
   git checkout -b fix-issue-<issue-number>
   ```
   *(Example: `git checkout -b fix-issue-5`)*

### 3. Setup and Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
4. If working with the Groq API, get a free key from [console.groq.com/keys](https://console.groq.com/keys) and paste it into the UI.

### 4. Code Quality & Standards
Before committing your code, make sure the project compiles and follows the style guide:
```bash
# Run ESLint checks
npm run lint

# Verify production build succeeds
npm run build
```
- Write clean, readable code and keep components modular.
- Do not introduce unrelated changes or refactors outside the scope of your claimed issue.
- **Never commit API keys or secrets** to git.

### 5. Commit and Push
Commit with a descriptive message:
```bash
git add .
git commit -m "Fix #<issue-number>: <short description of change>"
git push origin fix-issue-<issue-number>
```

### 6. Open a Pull Request
1. Go to your fork on GitHub and click **Compare & pull request**.
2. Set the base repository to `PSIT-GDGOC/narrate-ai` and base branch to `main`.
3. **CRITICAL REQUIREMENT**: In your PR description, you must include:
   ```markdown
   Fixes #<issue-number>
   ```
   *(e.g., `Fixes #7` or `Closes #7`). Our automated webhook relies on this keyword to automatically record and credit your contribution!*
4. Include a brief summary of changes and attach screenshots or screen recordings for any UI changes.

---

## 💬 Need Help?

If you encounter any issues or have questions regarding an assigned task, leave a comment directly on the GitHub issue or reach out via the GDGOC PSIT community channels.

Happy Hacking! 🚀
