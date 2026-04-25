# BU-04 Network Coordinator Dashboard
# Implements: Addendum 01 §3 (Network Coordinator role), hybrid visibility principle
#
# Out of scope:
# - Individual member records visible to coordinators (hybrid visibility = aggregate only)
# - Coordinator-to-member messaging (deferred to later phase)
# - Cross-network coordinator views (each coordinator sees only their network)
# - Custom date ranges or report exports (basic counts only in v1)

Feature: Network Coordinator sees aggregate stats for their network only
  As a Network Coordinator, I want aggregate insight into my network's GPS engagement
  so I can report value back to my members without breaching their individual privacy.

  Background:
    Given the partner network "CUFI" exists
    And Alistair is a Network Coordinator for CUFI
    And 200 volunteers have home_network_id = CUFI
    And 150 of those are active (logged in within the last 30 days)
    And those volunteers have collectively completed 87 tasks this month

  Scenario: Coordinator dashboard shows aggregate counts
    When Alistair opens his Network Coordinator dashboard
    Then he sees "Members enrolled: 200"
    And "Members vetted and active: 150"
    And "Active in last 30 days: 150"
    And "Tasks completed this month: 87"

  Scenario: Coordinator cannot see individual member records
    Given Alistair is on the Network Coordinator dashboard
    When he attempts to navigate to a list of CUFI members
    Then he is shown the aggregate dashboard, not a member list
    And no individual member name, email, or activity is visible

  Scenario: Coordinator cannot see other networks' stats
    Given another partner network "FutureNetwork" has 50 enrolled members
    When Alistair views his dashboard
    Then he sees only CUFI's numbers
    And he sees no reference to FutureNetwork or GPS-direct totals

  Scenario: Multiple coordinators per network share the same view
    Given a second coordinator "Naomi" is added to CUFI
    When Naomi opens her Network Coordinator dashboard
    Then she sees the same aggregate stats Alistair sees
    And both coordinators are listed in CUFI's network_coordinators junction table
