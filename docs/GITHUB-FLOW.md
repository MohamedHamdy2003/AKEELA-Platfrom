# GitHub PR Flow

Repository: [MohamedHamdy2003/AKEELA-Platfrom](https://github.com/MohamedHamdy2003/AKEELA-Platfrom)

**Feature branch → PR to dev → Complete flow → Owner requests release → PR from dev to main**

| Branch                 | Purpose                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `main`                 | Release baseline. Update only when the owner explicitly requests promotion of a completed flow. |
| `dev`                  | Integrate completed features.                                                                   |
| `feature/<short-name>` | One feature, created from current `dev`.                                                        |

## Feature work

1. Read `AGENTS.md` and relevant specifications; work only on an authorized feature.
2. Update `dev` and create a feature branch:

```sh
git switch dev
git pull --ff-only origin dev
git switch -c feature/email-auth
```

3. Implement the feature, update its docs, and run `npm run check` plus relevant integration tests.
4. Commit and push the feature branch; open a PR with **base `dev`**.
5. Describe the change and validation, review the diff, resolve conflicts on the feature branch, and merge the completed feature into `dev`. Use a squash merge for feature PRs.

## Release

Only after the owner explicitly requests it: verify the full flow on `dev`, open a PR with **base `main` and head `dev`**, then merge after review. Use a merge commit for release PRs so shared branch history is preserved. Keep `dev` aligned with `main` afterward.

Do not commit features directly to `dev` or `main`, force-push shared branches, or merge unfinished work. The one-time initial foundation creates both branches from the same snapshot. No deployment or branch-protection policy is configured by this document.
