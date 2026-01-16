---
allowed-tools: Read, TodoWrite, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Skill(spec:spec-knowledge)
description: Review specification with spec-knowledge skill
---

# Rule

The `<execute>ARGUMENTS</execute>` will execute the main procedure.

# Consistent

The specification review should ensure consistency in terminology, formatting, and structure throughout the document.

- Naming Consistency: Ensure that terms and names are used consistently.
- Formatting: Check for uniform formatting styles (headings, lists, code blocks).
- Structure: Verify that sections and subsections follow a logical order.
- Clarity: Ensure that the specification is clear and unambiguous.

# Definition

<procedure name="main">
    <description>Review specification with spec-knowledge skill</description>
    <step>1. activate the spec-knowledge skill</step>
    <step>2. read SPEC.md to gather information about the specification</step>
    <step>3. according to the knowledge from spec-knowledge skill, analyze the specification for potential issues, improvements, or clarifications needed</step>
    <step>4. pick high-priority items that need attention</step>
    <step>5. ask user to clarify with proposed changes or questions regarding the specification</step>
    <condition if="apply changes">
        <step>6. document the proposed changes or questions in a structured format</step>
    </condition>
    <return>Specification review summary and actions</return>
</procedure>

# Task

<execute name="main">$ARGUMENTS</execute>
