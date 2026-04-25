# BU-05 Intelligence & Alerts
# Implements: Addendum 01 §5.2 (primary + secondary action pattern)
#
# Out of scope:
# - User-defined custom actions (AI suggests from a fixed action taxonomy)
# - Automatic action execution without human approval (always requires click)
# - Re-ranking of secondary actions by user (AI rank is fixed per alert)

Feature: Each alert surfaces one primary action with secondary alternatives
  As a volunteer, I want a clear single recommended action per alert
  so I'm not paralysed by choice on the feed.

  Background:
    Given an alert exists about a council motion in Derby
    And the AI has generated suggested actions ranked by recommendation strength

  Scenario: Feed view shows only the primary action
    When Rachel views the alert in her feed
    Then she sees the alert with one primary action: "Email council leader (draft prepared)"
    And no secondary actions are shown in the feed view

  Scenario: Detail mode reveals ranked secondary actions
    When Rachel opens the alert detail view
    Then she sees the primary action prominently
    And below it, secondary actions ranked by AI confidence:
      | rank | action                                |
      | 2    | Letter to local newspaper editor      |
      | 3    | Social media post (draft prepared)    |
      | 4    | Petition to council (draft prepared)  |
    And each secondary action is independently actionable

  Scenario: Volunteer takes the primary action
    Given Rachel is in the detail view
    When Rachel clicks "Send" on the primary action
    Then the action is logged as "primary_taken"
    And no signal is captured about secondary preferences

  Scenario: Volunteer skips primary and takes a secondary action
    Given Rachel is in the detail view
    When Rachel ignores the primary and clicks "Send" on the rank-3 social media post
    Then the action is logged as "secondary_taken" with selected_rank = 3
    And the AI training signal "primary_skipped, rank_3_chosen" is captured
    And this signal is available for future model tuning

  Scenario: Volunteer takes both primary and a secondary in parallel
    When Rachel sends the primary action
    And Rachel also sends the rank-2 letter to editor
    Then both actions are logged
    And the alert detail view shows both as completed
