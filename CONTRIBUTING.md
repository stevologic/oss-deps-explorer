# Contributing to oss-deps-explorer

Thank you for taking the time to contribute! This project welcomes both issues and pull requests.

## Submitting Issues

* Search the existing [issues](https://github.com/stevologic/oss-deps-explorer/issues) before filing a new one.
* Include a clear description of the problem or suggestion.
* Provide steps to reproduce bugs when applicable.

## Pull Requests

1. Fork the repository and create your feature branch off of `development`
   (day-to-day integration happens there; `development` is merged to `main`
   via pull request):
   ```bash
   git checkout -b feature/my-change development
   ```
2. Follow the coding standards described below.
3. Commit your changes with a meaningful commit message.
4. Push the branch and open a pull request against `main` on GitHub.

### Coding Standards

* All Go code should be formatted with `go fmt`.
* Keep functions small and focused.
* Add unit tests where possible.

### Running Tests

```bash
go vet ./...
go test ./...
node --test "ui/**/*.test.mjs"   # UI export/builder tests (Node 22+)
```

### Branch Naming

Use descriptive branch names prefixed with the type of change:

* `feature/` for new features
* `bugfix/` for bug fixes
* `docs/` for documentation changes

Example:
```bash
feature/add-cache-support
```

### Commit Messages

* Use the imperative mood in the subject line ("Add feature" not "Added feature").
* Limit the subject line to 72 characters.
* Use the body to explain **why** the change was made, not just **what** was done.
