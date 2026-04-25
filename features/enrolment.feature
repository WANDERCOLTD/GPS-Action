# BU-02 Enrolment & Vetting
# Implements: SRS §3.3 (Enrolment Routing), §6.1 (Volunteer Profiles)
# Addendum 01: three form variants, signed tokens, vetter override
#
# Out of scope:
# - Delegated vetting UI (deferred; vetting_scope column scaffolded only)
# - Multi-network membership per volunteer (single network today)
# - Self-service network change after enrolment (vetter does it)

Feature: Volunteer enrolment routing
  As GPS, we want enrolment routed to the correct home network
  so that partner attribution is preserved and vetting can verify origin.

  Background:
    Given the master network "GPS" exists with is_master = true
    And the partner network "CUFI" exists with parent_network_id = GPS
    And a vetter "Sarah" is on the Vetting Team with vetting_scope = "all"

  Scenario: Direct enrolment via the public GPS form
    Given a prospective volunteer "Daniel" visits gps.org.uk/enrol
    When Daniel submits name, postcode, and email
    Then a volunteer record is created with home_network_id = GPS
    And the record status is "pending"
    And the record appears in Sarah's vetting queue

  Scenario: Partner-locked enrolment via signed link
    Given Alistair has shared a CUFI enrolment link "/enrol?network=cufi&sig=<valid>"
    When a CUFI member "Rachel" opens the link
    Then she sees the enrolment form with the network field pre-filled "CUFI"
    And the network field is visibly locked (greyed, non-editable)
    And the form caption reads "Joining via CUFI"
    When Rachel submits the form
    Then a volunteer record is created with home_network_id = CUFI
    And the co-branded confirmation page displays both GPS and CUFI logos

  Scenario: Tampered partner link falls back to open form
    Given a URL "/enrol?network=cufi&sig=<tampered>"
    When a user opens the link
    Then signature validation fails
    And the form falls back to the open enrolment variant
    And the network field is user-selectable from a dropdown, not pre-filled
    And a security event "invalid_enrolment_signature" is logged

  Scenario: Open enrolment form with user-selected network
    Given a prospective volunteer "Mark" visits the open enrolment form
    When Mark selects "CUFI" from the home network dropdown
    And submits name, postcode, and email
    Then a volunteer record is created with home_network_id = CUFI
    And the record enters the vetting queue

  Scenario: Vetter overrides home network on approval
    Given a pending volunteer "Emma" has home_network_id = GPS
    And Sarah has reviewed Emma's record
    When Sarah changes home_network to "CUFI" and clicks Approve
    Then Emma's record reflects home_network_id = CUFI
    And the audit log records: actor = Sarah, action = "network_override", old = GPS, new = CUFI, timestamp recorded
    And Emma's account is activated
