# BU-02 Enrolment & Vetting
# Implements: SRS §3 (User Roles), §6.1 (verification)
# Addendum 01: is_vetter flag, vetting_scope scaffolded for future delegation
#
# Out of scope:
# - Delegated vetting UI (the scoped-vetter scenario below documents future intent only)
# - Bulk approval / rejection actions
# - Automated pre-screening of applicants (manual review only in v1)

Feature: Vetting team approves new volunteers
  As GPS, we vet every applicant before granting platform access
  so that only verified people can act on behalf of GPS.

  Background:
    Given a volunteer "Tom" has submitted enrolment with home_network_id = CUFI
    And Tom's record status is "pending"

  Scenario: Vetter with global scope can vet any applicant
    Given Sarah has is_vetter = true and vetting_scope = "all"
    When Sarah opens her vetting queue
    Then she sees Tom's record
    When Sarah clicks Approve
    Then Tom's status becomes "active"
    And Tom receives an account activation email
    And the audit log records the approval

  Scenario: Vetter rejects an applicant with reason
    Given Sarah is reviewing Tom's record
    When Sarah clicks Reject and selects reason "incomplete information"
    Then Tom's status becomes "rejected"
    And Tom receives a rejection email
    And the rejection reason is stored on the record
    And the audit log records the rejection

  Scenario: Future-scaffolded delegated vetting (deferred UI)
    # This scenario documents the intended future behaviour
    # The vetting_scope column exists from BU-02 onwards
    # The UI to assign scoped vetters ships in a later BU
    Given a hypothetical user "Alistair" has is_vetter = true and vetting_scope = "CUFI"
    When Alistair opens his vetting queue
    Then he sees only records where home_network_id = CUFI
    And he does not see records from GPS-direct or other partner networks
