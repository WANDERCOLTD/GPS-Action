# BU-03 Volunteer CRM & Profile
# Implements: SRS §6.1 (Volunteer Profiles), §3.1 (Geographic Permissions)
# Addendum 01: AG membership, AG Leader flag, display name setting, network badge
#
# Out of scope:
# - Volunteer self-editing of region assignments (admin-controlled in v1)
# - Skills inference from past actions (manual entry only)
# - AG creation by non-admins

Feature: Volunteer profile fields and assignments
  As an admin, I want each volunteer's profile to capture their region, AGs, and identity preferences
  so that alerts route correctly and identity is handled per the volunteer's wishes.

  Background:
    Given an active volunteer "Rachel" with home_network_id = CUFI
    And the regions "East Midlands > Derbyshire > Derby" exist in the geographic hierarchy
    And the action groups "Newspaper", "Radio", "Petitions" exist

  Scenario: Admin assigns regions hierarchically
    When an admin assigns Rachel to "East Midlands"
    Then Rachel has access to alerts for East Midlands and all child regions
    And Rachel sees Derbyshire and Derby in her assigned regions list

  Scenario: Volunteer belongs to multiple Action Groups
    When an admin assigns Rachel to AGs "Newspaper" and "Radio"
    Then Rachel's profile shows AG membership = ["Newspaper", "Radio"]
    And Rachel's feed defaults to filtering for these two AGs

  Scenario: Volunteer is Action Group Leader of one AG, member of another
    Given Rachel is a member of "Newspaper" and "Radio"
    When an admin sets Rachel as AG Leader of "Newspaper"
    Then Rachel's profile shows ag_leader_of = ["Newspaper"]
    And Rachel can perform AG Leader actions in Newspaper
    And Rachel cannot perform AG Leader actions in Radio
