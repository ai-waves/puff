# Playbook: hand off

Run this at the end of every working session, even an unfinished one, so the next agent (or person)
can pick up without guessing.

1. **Verify what you can** ([verify.md](verify.md)), and note what you didn't run.
2. **Update [STATUS.md](../STATUS.md):**
   - `_Last updated:_` to today's date.
   - **Built:** add what now exists.
   - **Verified:** the checks you ran, with their real results and the date.
   - **In progress:** remove your line, or leave it with exactly where you stopped and what's next.
   - **Known issues:** add anything you found and didn't fix. Remove what you fixed.
3. **Update [ROADMAP.md](../ROADMAP.md):** tick finished items, and add new work you discovered, with
   acceptance criteria.
4. **Record decisions:** add a record to [DECISIONS.md](../DECISIONS.md) for any lasting choice.
5. **Update the other docs:** the README for anything a player or designer would see. Change
   [AGENTS.md](../../AGENTS.md) only if a rule or command changed.
6. **Commit and push.** Use small commits with clear messages, then `git push -u origin <branch>`.
   Open a pull request only if the user asked.
7. **Tell the user,** in a few lines:
   - what changed
   - what's verified, and how
   - what isn't verified
   - what you recommend next
   - anything that needs their decision

   Lead with the outcome, and be exact about anything that failed or was skipped.
