# Git Guide for Your Playwright Automation Project

## What is Git?
Git is a version control system that helps you track changes to your code over time. Think of it like a save system for your entire project that lets you:
- See what changed and when
- Go back to previous versions
- Work on different features simultaneously
- Collaborate with others safely

## Your Project Setup
✅ **Already Done for You:**
- Git repository initialized
- All your current files committed
- Proper `.gitignore` file created (ignores temporary files, logs, etc.)
- Basic user configuration set up

## Essential Git Commands

### Checking Status
```bash
git status
```
Shows what files have changed since your last commit.

### Adding Changes
```bash
# Add a specific file
git add filename.js

# Add all changed files
git add .

# Add all files in a directory
git add foldername/
```

### Making Commits (Saving Your Progress)
```bash
# Commit with a message describing what you changed
git commit -m "Add new feature for merchant testing"

# Add and commit in one step
git commit -am "Fix bug in popup.js"
```

### Viewing History
```bash
# See all commits
git log

# See a simplified one-line view
git log --oneline

# See what changed in the last commit
git show
```

### Working with Branches (Advanced)
```bash
# Create a new branch for a feature
git branch feature-name

# Switch to a branch
git checkout feature-name

# Create and switch to a new branch in one command
git checkout -b new-feature

# See all branches
git branch

# Merge a branch back to main
git checkout main
git merge feature-name
```

## Daily Workflow

1. **Check what's changed:**
   ```bash
   git status
   ```

2. **Add your changes:**
   ```bash
   git add .
   ```

3. **Commit your changes:**
   ```bash
   git commit -m "Describe what you changed"
   ```

4. **Repeat as needed!**

## Common Scenarios

### "I want to save my current work"
```bash
git add .
git commit -m "Work in progress on [describe what you're working on]"
```

### "I want to see what I changed"
```bash
git status          # See which files changed
git diff            # See exactly what changed
git diff filename   # See changes in a specific file
```

### "I made a mistake in my last commit message"
```bash
git commit --amend -m "New commit message"
```

### "I want to undo changes to a file"
```bash
# Undo changes to a file (before adding/committing)
git checkout -- filename

# Undo all changes since last commit
git reset --hard HEAD
```

### "I want to go back to a previous version"
```bash
# See your commit history
git log --oneline

# Go back to a specific commit (replace abc123 with actual commit hash)
git checkout abc123

# Go back to the latest version
git checkout main
```

## Your Project Structure
Your `.gitignore` file is set up to automatically ignore:
- `node_modules/` (Node.js dependencies)
- `browser-data/` (sensitive browser profiles)
- `test-results/` (temporary test files)
- `*.log` files
- Environment files (`.env`)
- And many other temporary/sensitive files

## Configuration
Your Git is configured with:
- **Name:** Neil Jones
- **Email:** neil@example.com

To change these:
```bash
git config user.name "Your Actual Name"
git config user.email "your.email@example.com"
```

## Tips for Success

1. **Commit often:** Small, frequent commits are better than large ones
2. **Write good commit messages:** Describe what you changed and why
3. **Use branches:** For big features, create a new branch
4. **Check status regularly:** `git status` is your friend
5. **Don't panic:** Almost everything in Git can be undone

## Getting Help
```bash
git help              # General help
git help command      # Help for a specific command (e.g., git help commit)
```

## Working with GitHub

Your project is now synced with GitHub at: **https://github.com/njoneswssu/QA-tools**

### Pushing Changes to GitHub
After making local commits, sync them to GitHub:
```bash
git push origin main
```

### Pulling Changes from GitHub
If you make changes on GitHub or from another computer:
```bash
git pull origin main
```

### Complete Workflow
1. Make changes to your files
2. Add and commit locally:
   ```bash
   git add .
   git commit -m "Describe your changes"
   ```
3. Push to GitHub:
   ```bash
   git push origin main
   ```

### Authentication
- **Username:** njoneswssu
- **Password:** Use your personal access token (not your GitHub password)
- Your token starts with `ghp_` and was created in GitHub Settings → Developer settings → Personal access tokens

### Viewing Your Project Online
Visit https://github.com/njoneswssu/QA-tools to see your code online, share it with others, or access it from any computer.

## Next Steps
1. Try making a small change to any file
2. Run `git status` to see it
3. Add and commit the change: `git commit -am "Test change"`
4. Push to GitHub: `git push origin main`
5. Check your GitHub repository online to see the changes!

Remember: Git is like a safety net for your code, and GitHub is your online backup and portfolio. The more you use them, the more confident you'll become!
