# BU-05 Intelligence & Alerts
# Implements: SRS §4.3 (Alert Generation), §3.1 (Geographic Permissions)
# Addendum 01: AG tagging on alerts, shared-record model, cross-AG forwarding
#
# Out of scope:
# - AI-suggested AG tagging at alert creation (manual or rule-based in v1)
# - Cross-region forwarding (region is set at creation, not re-routable)
# - Alert merging or deduplication (each scrape produces a distinct alert)

Feature: Alerts route to volunteers by region and Action Group
  As GPS, we want alerts to reach the right volunteers based on geography and topic
  so that response is fast and locally informed.

  Background:
    Given the regions "East > Suffolk > Bury St Edmunds" exist
    And the action groups "Newspaper", "Radio", "Petitions" exist
    And Sharon is assigned to East and is AG Leader of "Newspaper"
    And Mark is assigned to East and is a member of "Radio"
    And Tabatha is assigned to East and is AG Leader of "Petitions"

  Scenario: Alert is created with region and one AG tag
    Given a scraped article mentions a school in Bury St Edmunds
    When the system generates an alert
    And the alert is tagged with region "Bury St Edmunds" and AG "Newspaper"
    Then the alert appears in Sharon's feed
    And the alert does not appear in Mark's or Tabatha's default feed

  Scenario: AG Leader forwards an alert to another AG
    Given the Bury St Edmunds alert is in Sharon's feed tagged "Newspaper"
    When Sharon clicks "Also send to..." and selects "Radio"
    Then the alert's AG tags become ["Newspaper", "Radio"]
    And the alert appears in Mark's feed
    And Mark and Sharon see the same shared record (one alert, not two copies)
    And the alert's status, assignee, and notes are shared between both AGs

  Scenario: Status change on a shared alert is visible to all tagged AGs
    Given the alert is tagged ["Newspaper", "Radio"]
    And the status is "Unassigned"
    When Mark claims the alert and changes status to "In Progress"
    Then Sharon sees the alert as "In Progress" assigned to Mark
    And the change is recorded once in the audit log

  Scenario: Volunteer widens feed beyond their default AGs
    Given Sharon's default feed shows only "Newspaper" alerts
    When Sharon clicks "Show all AGs"
    Then she sees alerts from every AG in her assigned region
    And her default filter preference is unchanged
