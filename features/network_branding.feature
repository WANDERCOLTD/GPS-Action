# BU-03 Volunteer CRM & Profile
# Implements: Addendum 01 §2.1 (per-volunteer network badge)
#
# Out of scope:
# - Custom partner-network themes (chrome stays GPS-branded always)
# - Animated or interactive badges (static logo only)
# - Badges on email communications (in-app only for v1)

Feature: Network badge on volunteer attributions
  As a CUFI member using GPS, I want my CUFI affiliation visible
  so that the network-of-networks story is real and visible to the community.

  Scenario: CUFI member sees their network badge on their own profile
    Given Rachel has home_network_id = CUFI
    When Rachel views her own profile
    Then a small CUFI logo badge appears next to her display name

  Scenario: Other volunteers see Rachel's CUFI badge on her posts
    Given Rachel authors a post in the Newspaper AG
    When another volunteer views the post in their feed
    Then the post attribution shows "@rcohen · CUFI" with the CUFI logo

  Scenario: GPS-direct volunteer shows no partner badge
    Given a volunteer "Daniel" has home_network_id = GPS
    When his name appears on a post
    Then no partner network badge is displayed
    And the GPS app chrome remains GPS-branded

  Scenario: App chrome stays GPS-branded for all users
    Given Rachel (CUFI) and Daniel (GPS-direct) both log in
    When each views the platform header, navigation, and footer
    Then both see GPS branding throughout the app chrome
    And only the per-volunteer badges differ
