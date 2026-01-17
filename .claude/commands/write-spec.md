---
allowed-tools: Read, TodoWrite, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Skill(spec:spec-knowledge)
description: Create or update specification with spec-knowledge skill
---

# Rule

The `<execute>ARGUMENTS</execute>` will execute the main procedure.

# Principles

When creating or updating specifications, follow these principles:

- Reviewed: Ensure that the specification has been self-reviewed via the spec-knowledge skill for completeness and clarity.
- Test Coverage: Ensure that the specification change didn't cause any test coverage reductions.
- Keep it Simple: Never add more complexity than necessary to the specification, refactor or extend existing specifications where possible.

# Definition

<procedure name="main">
    <description>Create or update specification with spec-knowledge skill</description>
    <parameter name="brief" type="string" optional="true">A brief description of the feature or change to be specified.</parameter>
    <step>1. activate the spec-knowledge skill</step>
    <step>2. read SPEC.md to gather information about the existing specification</step>
    <step>3. if a brief is provided, use it to guide the creation or update of the specification</step>
    <step>4. analyze the current specification for completeness and clarity</step>
    <step>5. identify areas that need new specifications or updates based on recent changes in the codebase or user requirements</step>
    <step>6. ask user to clarify with proposed changes or questions regarding the specification</step>
    <condition if="new feature or change identified">
        <step>7. create or update the specification to accurately reflect the new feature or change</step>
    </condition>
    <step>8. ensure that the specification is clear, concise, and follows best practices</step>
    <step>9. document any assumptions or decisions made during the specification process</step>
    <step>10. review the updated specification for accuracy and completeness</step>
    <step>11. save the updated SPEC.md and related documentation</step>
    <return>Updated specification document and summary of changes</return>
</procedure>

# Task

<execute name="main">$ARGUMENTS</execute>
