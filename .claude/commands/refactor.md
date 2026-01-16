---
allowed-tools: Read, TodoWrite, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Skill(spec:spec-knowledge)
description: Refactor codebase to improve structure, readability, and maintainability
---

# Rule

The `<execute>ARGUMENTS</execute>` will execute the main procedure.

# Best Practices

Following is ordered by priority:

- Clear and Consistent Naming: Use meaningful and consistent names for variables, functions, and classes.
- Keep Simple: Aim for simplicity in design and implementation.
- SOLID Principles: Adhere to SOLID principles for object-oriented design.
- DRY (Don't Repeat Yourself): Eliminate redundancy by abstracting repeated code.
- Design Patterns: Utilize appropriate design patterns where applicable.

# Definition

<procedure name="main">
    <description>Refactor codebase to improve structure, readability, and maintainability</description>
    <parameter name="focus_areas" optional="true">Specific areas to focus on to review (e.g., cli package, naming conventions)</parameter>
    <step>1. review the current codebase structure and organization or {focus_areas} if provided</step>
    <step>2. identify code smells, redundant code, and areas for improvement</step>
    <step>3. create a refactoring plan prioritizing high-impact changes</step>
    <step>4. review any specifications need to align or update them accordingly</step>
    <condition if="specifications updated">
        <step>5. document the changes made to specifications</step>
    </condition>
    <step>6. confirm with user with refactoring plan and proposed changes</step>
    <condition if="user approves">
        <step>7. implement the refactoring changes in the codebase</step>
        <step>8. test the refactored code to ensure functionality remains intact</step>
    </condition>
    <return>Refactored codebase and documentation of changes</return>
</procedure>

# Task

<execute name="main">$ARGUMENTS</execute>

