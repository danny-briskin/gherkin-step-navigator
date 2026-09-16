Feature: DocString diagnostics
  Scenario: Payload with narrative text
    Given the Python user has 10 items
    """
    A payload description follows.
    So it should not be treated as a step.
    * This bullet point uses the Gherkin "*" step alias but is just content.
    """
