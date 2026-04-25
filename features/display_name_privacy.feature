# BU-03 Volunteer CRM & Profile
# Implements: Addendum 01 §6.3 (Identity & Display Name)
#
# Out of scope:
# - Per-AG display name overrides (one global preference)
# - Anonymous mode (different feature; not in addendum)
# - Pseudonymous handles distinct from username (handle = username for v1)

Feature: Volunteer display name preference
  As a volunteer, I want to control how my name appears across the platform
  so that I can act with the level of identity exposure I'm comfortable with.

  Background:
    Given an active volunteer with full name "Rachel Cohen", first name "Rachel", and handle "@rcohen"

  Scenario: Default display name is the handle
    Given Rachel has not changed her display name preference
    When her name appears anywhere in the platform
    Then it displays as "@rcohen"

  Scenario: Volunteer opts up to first name
    When Rachel sets display name preference to "first_name"
    Then her name appears as "Rachel" on her profile
    And on every post she authors
    And on every task she's assigned to
    And in every audit log entry visible to other users

  Scenario: Volunteer opts up to full name
    When Rachel sets display name preference to "full_name"
    Then her name appears as "Rachel Cohen" everywhere her display name is shown

  Scenario: Display name preference applies to action attributions on sensitive tasks
    Given Rachel has display name preference = "handle"
    And Rachel completes a task linked to a sensitive alert
    When another volunteer views the task history
    Then the actor is shown as "@rcohen", not "Rachel Cohen"
