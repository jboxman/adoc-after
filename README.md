# Purpose

This collection of scripts explores what kind of introspection is available to
perform on AsciiDoc files. Because there is no AST available for AsciiDoc files,
the approaches taken herein utilize what information is available after an AsciiDoc
file builds successfully.

# Scripts

- `hack/`: Various experiments
- `spell-check.js`: Gather all unknown words in a file
- `attic/get-yaml.js`: Promoted to https://github.com/jboxman/asciidoc-validate-yaml
