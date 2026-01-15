---
allowed-tools: Read, TodoWrite, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Skill(spec:spec-knowledge)
description: Align specification and codebase with spec-knowledge skill
---

# Rule

The `<execute>ARGUMENTS</execute>` will execute the main procedure.

# Definition

<procedure name="main">
    <description>Align specification and codebase with spec-knowledge skill</description>
    <step>1. activate the spec-knowledge skill</step>
    <step>2. read SPEC.md to gather information about the specification</step>
    <step>3. explore the codebase to identify areas that may not align with the specification</step>
    <step>4. use git commands to check recent changes that might have affected alignment</step>
    <step>5. identify discrepancies between the specification and the codebase, e.g., missing features, redundant code, outdated implementations, or missing tests</step>
    <step>6. ask user to clarify with proposed changes or questions regarding the alignment</step>
    <condition if="codebase out of sync">
        <step>7. plan necessary updates to the codebase or specification to ensure alignment</step>
    </condition>
    <condition if="specification needs updates">
        <step>8. document the proposed changes or questions in a structured format</step>
    </condition>
    <condition if="redunedant code found">
        <step>9. suggest removal or refactoring of redundant code to better match the specification</step>
    </condition>
    <condition if="feature removed from spec">
        <step>10. suggest deprecation of related code sections</step>
    </condition>
    <condition if="new feature added to spec">
        <step>11. suggest implementation steps for the new feature in the codebase</step>
    </condition>
    <return>Specification and codebase alignment summary and actions</return>
</procedure>

# Task

<execute name="main">$ARGUMENTS</execute>
