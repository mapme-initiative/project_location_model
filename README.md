# Readme
# Install
GUI 
```bash
cd frontend && npm install
npm run dev
```


# Analyize-Tools
* SonarQube: for code quality
* CodeQL: for code security
* Dependabot: for dependency updates (maybe renovate-bot)
* Test-Coverage: through jest and is visible in pull-requests

# Structure
* frontend: the React frontend
* model: json-schema-files

# How example-excel-files work
* the files are automatically copied from assets
* to make them visible for the end-user - you've to add a link in the [FileValidator.tsx](../../src/components/FileValidator.tsx) file
