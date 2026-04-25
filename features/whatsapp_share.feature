# BU-08 Content Library (and reusable across BUs)
# Implements: Addendum 01 §11 (WhatsApp share affordance)
#
# Out of scope:
# - WhatsApp Business API integration (deep links only for v1)
# - Server-side message sending (purely client-side)
# - Tracking of downstream forwards once sent (not visible to GPS)
# - Pre-selected recipient lists (user picks recipients in WhatsApp itself)

Feature: Share content via WhatsApp deep link
  As a volunteer, I want to share GPS content into my own WhatsApp groups quickly
  so that GPS messaging spreads through my personal networks.

  Background:
    Given a volunteer "Rachel" is logged in
    And a content item "Counter-BDS factsheet" exists in the Content Library

  Scenario: Share factsheet via WhatsApp
    When Rachel opens the factsheet
    And clicks "Send via WhatsApp"
    Then a WhatsApp deep link opens in a new tab/window
    And the URL matches "https://wa.me/?text=<encoded factsheet summary + link>"
    And the share event is logged: actor = Rachel, content_id = factsheet, channel = "whatsapp"

  Scenario: WhatsApp share affordance available on posts
    Given a post exists tagged with AG "Newspaper"
    When Rachel views the post
    Then a "Send via WhatsApp" button is visible
    When Rachel clicks it
    Then the WhatsApp deep link opens with the post body pre-filled

  Scenario: Same pattern for SMS and email
    Given Rachel is viewing the factsheet
    Then she sees share buttons for: WhatsApp, SMS, Email
    When Rachel clicks "Send via SMS"
    Then a deep link opens matching "sms:?body=<encoded content>"
    When Rachel clicks "Send via Email"
    Then a mailto link opens matching "mailto:?subject=<title>&body=<content>"

  Scenario: No WhatsApp Business API integration required
    Given the share affordance exists
    Then no WhatsApp API credentials are configured
    And no message is sent server-side
    And the share is purely a client-side deep link
