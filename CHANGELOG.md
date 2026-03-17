# Changelog

## 1.0.5
### Fixes & Improvements
- Nested Syntax Highlighting: Fixed an issue where Scenario Outline parameters (e.g., `<param>`) were not correctly colorized when placed inside quoted strings.

## 1.0.4
### Fixes & Improvements
- Advanced Comment Alignment: Implemented context-aware indentation for comments. Comments now "cling" to the following element (tags or scenarios) unless separated by an empty line.
- Table-Comment Handling: Improved detection of table-specific comments (`# |`), ensuring they maintain a consistent indentation to align with table pipes.
- Empty Line Sanitization: The formatter now strips trailing whitespace from empty lines, reducing them to zero-length strings for a cleaner document structure.
- Stability Fixes: Enhanced the indentation resolution loop to ensure stable formatting for complex files with multiple nested tags and comments.

## 1.0.3
### Fixes & Improvements
- Ambiguous Step Resolution: Fixed a bug where steps like "User can see given..." incorrectly matched regex definitions like "User can see (\d+)...".

## 1.0.2
### Fixes & Improvements
- Scenario Outline Parameter <parameter> placeholders Support in Gherkin steps.

## 1.0.1
### New Features
- Contextual Tag Alignment: Tags now automatically inherit the indentation level of the following element (Feature, Scenario, Example, etc).
### Fixes & Improvements
- EOF Buffer Flush: Fixed a bug where tags at the end of a file were ignored by the formatter.
- Table Alignment: Improved pipe-spacing accuracy for varied column widths.

## 1.0.0
- Initial release.
