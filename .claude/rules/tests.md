# Tests

- The acceptance tests of a user story are written from its acceptance criteria **before** the implementation, and they must fail first.
- At least one test per criterion, named after it: "given …, when …, then …".
- Test behaviour through the public interface (route, exported function, rendered screen), never private details.
- Never weaken, skip or delete a test to make it pass. A test that contradicts the user story is reported, not rewritten.
- No test calls a real external service: use the doubles of the project.
- Before saying a change is done, run the full test suite, the linter and the type check, and report their result.
